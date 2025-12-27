local LrView = import 'LrView'
local LrPrefs = import 'LrPrefs'
local LrHttp = import 'LrHttp'
local LrPathUtils = import 'LrPathUtils'
local LrFileUtils = import 'LrFileUtils'
local LrDialogs = import 'LrDialogs'
local LrTasks = import 'LrTasks'
local LrDate = import 'LrDate'
local LrStringUtils = import 'LrStringUtils'

local JSON = require 'JSON'

local prefs = LrPrefs.prefsForPlugin()

local PublishServiceProvider = {
  small_icon = nil,
  supportsIncrementalPublish = 'only',
  hideSections = { 'exportLocation', 'video', 'outputSharpening', 'watermarking', 'fileNaming', 'imageSettings' },
  allowFileFormats = { 'JPEG' },
  allowColorSpaces = { 'sRGB' },
  hidePrintResolution = true,
  canExportVideo = false,
  exportPresetFields = {
    { key = 'quality', default = 100 },
  },
}

-- Build multipart form data for file upload
local function buildMultipartBody(filePath, fields, boundary)
  local body = ''

  -- Add text fields
  for key, value in pairs(fields) do
    body = body .. '--' .. boundary .. '\r\n'
    body = body .. 'Content-Disposition: form-data; name="' .. key .. '"\r\n\r\n'
    body = body .. tostring(value) .. '\r\n'
  end

  -- Add file
  local fileName = LrPathUtils.leafName(filePath)
  local fileContent = LrFileUtils.readFile(filePath)

  body = body .. '--' .. boundary .. '\r\n'
  body = body .. 'Content-Disposition: form-data; name="image"; filename="' .. fileName .. '"\r\n'
  body = body .. 'Content-Type: image/jpeg\r\n\r\n'
  body = body .. fileContent .. '\r\n'
  body = body .. '--' .. boundary .. '--\r\n'

  return body
end

-- Extract metadata from photo
local function getPhotoMetadata(photo)
  local meta = {}

  -- Camera info
  local camera = photo:getFormattedMetadata('cameraModel')
  if camera then meta.camera = camera end

  local lens = photo:getFormattedMetadata('lens')
  if lens then meta.lens = lens end

  -- Exposure info
  local exposure = photo:getFormattedMetadata('shutterSpeed')
  if exposure then meta.exposure = exposure end

  local aperture = photo:getFormattedMetadata('aperture')
  if aperture then meta.aperture = aperture end

  local iso = photo:getFormattedMetadata('isoSpeedRating')
  if iso then meta.iso = tostring(iso) end

  local focalLength = photo:getFormattedMetadata('focalLength')
  if focalLength then meta.focalLength = focalLength end

  -- Date
  local dateTime = photo:getRawMetadata('dateTimeOriginal')
  if dateTime then
    meta.date = LrDate.timeToUserFormat(dateTime, '%Y-%m-%d')
  end

  -- GPS location
  local gps = photo:getRawMetadata('gps')
  if gps then
    meta.location_lat = tostring(gps.latitude)
    meta.location_lng = tostring(gps.longitude)
  end

  -- Location name from IPTC
  local location = photo:getFormattedMetadata('location')
  local city = photo:getFormattedMetadata('city')
  local state = photo:getFormattedMetadata('stateProvince')
  local country = photo:getFormattedMetadata('country')

  local locationParts = {}
  if location and location ~= '' then table.insert(locationParts, location) end
  if city and city ~= '' then table.insert(locationParts, city) end
  if state and state ~= '' then table.insert(locationParts, state) end
  if country and country ~= '' then table.insert(locationParts, country) end

  if #locationParts > 0 then
    meta.location_name = table.concat(locationParts, ', ')
  end

  return meta
end

-- Get or create collection by name, returns collection ID
local function getOrCreateCollection(collectionName)
  local headers = {
    { field = 'Content-Type', value = 'application/json' },
    { field = 'X-API-Key', value = prefs.apiKey },
  }

  local body = JSON:encode({ name = collectionName })
  local url = prefs.apiUrl .. '/collections/get-or-create'

  local response, respHeaders = LrHttp.post(url, body, headers)

  if response and response ~= '' then
    local success, respData = pcall(function() return JSON:decode(response) end)
    if success and respData and respData.id then
      return respData.id
    end
  end

  return nil
end

-- Helper to make DELETE requests (handles SDK version differences)
local function httpDelete(url, headers)
  -- Add method override header for compatibility with older Lightroom versions
  local headersWithOverride = {}
  for _, h in ipairs(headers) do
    table.insert(headersWithOverride, h)
  end
  table.insert(headersWithOverride, { field = 'X-HTTP-Method-Override', value = 'DELETE' })

  -- Try with method parameter (SDK 10+), fallback handled by override header
  local response, respHeaders = LrHttp.post(url, '', headersWithOverride, 'DELETE', 30)
  return response, respHeaders
end

-- Cleanup empty collections
local function cleanupEmptyCollections()
  local headers = {
    { field = 'X-API-Key', value = prefs.apiKey },
  }

  local url = prefs.apiUrl .. '/collections/cleanup-empty'
  httpDelete(url, headers)
end

-- Publish/export photos
function PublishServiceProvider.processRenderedPhotos(functionContext, exportContext)
  -- Validate settings
  if not prefs.apiUrl or prefs.apiUrl == '' then
    LrDialogs.message('Configuration Error', 'API URL is not set. Please configure the plugin in Plug-in Manager.', 'critical')
    return
  end
  if not prefs.apiKey or prefs.apiKey == '' then
    LrDialogs.message('Configuration Error', 'API Key is not set. Please configure the plugin in Plug-in Manager.', 'critical')
    return
  end

  local exportSession = exportContext.exportSession
  local nPhotos = exportSession:countRenditions()

  -- Get collection name from the published collection
  local publishedCollection = exportContext.publishedCollection
  local collectionName = publishedCollection and publishedCollection:getName() or nil
  local collectionId = nil

  -- Get or create the collection in the API
  if collectionName then
    collectionId = getOrCreateCollection(collectionName)
  end

  local progressScope = exportContext:configureProgress({
    title = 'Publishing to Photo Gallery',
  })

  for i, rendition in exportContext:renditions({ stopIfCanceled = true }) do
    progressScope:setPortionComplete((i - 1) / nPhotos)

    local photo = rendition.photo
    local success, pathOrMessage = rendition:waitForRender()

    if success then
      local filePath = pathOrMessage

      -- Get photo info
      local title = photo:getFormattedMetadata('title') or ''
      local description = photo:getFormattedMetadata('caption') or ''
      local rating = photo:getRawMetadata('rating') or 0
      local flagStatus = photo:getRawMetadata('pickStatus')

      -- Get dimensions from source photo
      local width = photo:getRawMetadata('width') or 0
      local height = photo:getRawMetadata('height') or 0

      -- Featured = picked (flagged) photos
      local featured = (flagStatus == 1)

      -- Get metadata
      local meta = getPhotoMetadata(photo)

      -- Build form fields
      local fields = {
        title = title,
        description = description,
        alt = title,
        width = width,
        height = height,
        featured = tostring(featured),
        meta = JSON:encode(meta),
      }

      -- Add collection ID if we have one
      if collectionId then
        fields.collectionId = collectionId
      end

      -- Helper function to upload new photo via POST
      local function uploadNewPhoto()
        local boundary = 'PhotoGalleryBoundary' .. tostring(os.time())
        local body = buildMultipartBody(filePath, fields, boundary)

        local headers = {
          { field = 'Content-Type', value = 'multipart/form-data; boundary=' .. boundary },
          { field = 'X-API-Key', value = prefs.apiKey },
        }

        local url = prefs.apiUrl .. '/photos'
        local response, respHeaders = LrHttp.post(url, body, headers)

        if response and response ~= '' then
          local success, respData = pcall(function() return JSON:decode(response) end)
          if success and respData and respData.id then
            rendition:recordPublishedPhotoId(respData.id)
            rendition:recordPublishedPhotoUrl(url .. '/' .. respData.id)
            return true
          else
            rendition:uploadFailed('API error: ' .. tostring(response):sub(1, 200))
            return false
          end
        else
          rendition:uploadFailed('Failed to upload photo - no response from server')
          return false
        end
      end

      -- Check if this is an update (photo already published) or new upload
      local existingPhotoId = rendition.publishedPhotoId

      if existingPhotoId then
        -- Try to UPDATE existing photo via PUT (metadata only)
        local headers = {
          { field = 'Content-Type', value = 'application/json' },
          { field = 'X-API-Key', value = prefs.apiKey },
        }

        local updateData = {
          title = fields.title,
          description = fields.description,
          alt = fields.alt,
          featured = fields.featured,
          meta = meta,
        }

        -- Add collection ID if we have one
        if collectionId then
          updateData.collectionId = collectionId
        end

        local url = prefs.apiUrl .. '/photos/' .. existingPhotoId
        local response, respHeaders = LrHttp.post(url, JSON:encode(updateData), headers, 'PUT', 30)

        if response and response ~= '' then
          local success, respData = pcall(function() return JSON:decode(response) end)
          if success and respData and respData.id then
            -- Update succeeded
            rendition:recordPublishedPhotoId(respData.id)
            rendition:recordPublishedPhotoUrl(prefs.apiUrl .. '/photos/' .. respData.id)
          elseif success and respData and respData.error == 'Photo not found' then
            -- Photo was deleted from server, upload as new
            uploadNewPhoto()
          else
            -- Other error, try uploading as new photo
            uploadNewPhoto()
          end
        else
          -- No response, try uploading as new photo
          uploadNewPhoto()
        end
      else
        -- NEW photo - upload via POST
        uploadNewPhoto()
      end

      -- Clean up temp file
      LrFileUtils.delete(filePath)
    else
      rendition:uploadFailed(pathOrMessage)
    end
  end

  progressScope:done()

  -- Cleanup empty collections after publishing
  cleanupEmptyCollections()
end

-- Delete photos from service when removed from publish collection
function PublishServiceProvider.deletePhotosFromPublishedCollection(publishSettings, arrayOfPhotoIds, deletedCallback, localCollectionId)
  local failedDeletions = {}

  for i, photoId in ipairs(arrayOfPhotoIds) do
    local url = prefs.apiUrl .. '/photos/' .. photoId

    local headers = {
      { field = 'X-API-Key', value = prefs.apiKey },
    }

    local response, respHeaders = httpDelete(url, headers)

    -- Check if deletion was successful before calling callback
    if response then
      local success, respData = pcall(function() return JSON:decode(response) end)
      if success and respData and respData.message then
        -- Server confirmed deletion
        deletedCallback(photoId)
      elseif respHeaders and respHeaders.status == 200 then
        -- HTTP 200 without JSON body - assume success
        deletedCallback(photoId)
      else
        -- Deletion failed - don't mark as deleted
        table.insert(failedDeletions, photoId)
      end
    else
      -- No response - don't mark as deleted
      table.insert(failedDeletions, photoId)
    end
  end

  -- Warn user about failed deletions
  if #failedDeletions > 0 then
    LrDialogs.message(
      'Deletion Warning',
      'Failed to delete ' .. #failedDeletions .. ' photo(s) from the server. They may still exist on the remote gallery.',
      'warning'
    )
  end

  -- Cleanup empty collections after deletion
  cleanupEmptyCollections()
end

-- Check if we can update metadata
function PublishServiceProvider.metadataThatTriggersRepublish(publishSettings)
  return {
    default = true,
    title = true,
    caption = true,
    rating = true,
    pickStatus = true,
  }
end

return PublishServiceProvider
