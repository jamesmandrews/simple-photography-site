local LrView = import 'LrView'
local LrPrefs = import 'LrPrefs'
local LrBinding = import 'LrBinding'
local LrDialogs = import 'LrDialogs'
local LrHttp = import 'LrHttp'
local LrTasks = import 'LrTasks'

local prefs = LrPrefs.prefsForPlugin()

-- Initialize empty if not set
if not prefs.apiUrl then prefs.apiUrl = '' end
if not prefs.apiKey then prefs.apiKey = '' end

-- Note: Lightroom SDK stores preferences in plain text. The password_field provides
-- visual masking only, not secure storage. This is a limitation of the SDK.
-- For production use, consider running the API on localhost or a trusted network.

local PluginManager = {}

function PluginManager.sectionsForTopOfDialog(f, propertyTable)
  local bind = LrView.bind
  local share = LrView.share

  return {
    {
      title = 'Photo Gallery API Settings',
      synopsis = bind { key = 'apiUrl', object = prefs },

      f:row {
        f:static_text {
          title = 'API URL:',
          width = share 'label_width',
        },
        f:edit_field {
          value = bind { key = 'apiUrl', object = prefs },
          width_in_chars = 40,
          immediate = true,
        },
      },

      f:row {
        f:static_text {
          title = 'API Key:',
          width = share 'label_width',
        },
        f:password_field {
          value = bind { key = 'apiKey', object = prefs },
          width_in_chars = 40,
          immediate = true,
        },
      },

      f:row {
        f:push_button {
          title = 'Test Connection',
          action = function()
            LrTasks.startAsyncTask(function()
              -- Validate inputs
              if not prefs.apiUrl or prefs.apiUrl == '' then
                LrDialogs.message('Configuration Error', 'Please enter an API URL.', 'critical')
                return
              end
              if not prefs.apiKey or prefs.apiKey == '' then
                LrDialogs.message('Configuration Error', 'Please enter an API Key.', 'critical')
                return
              end

              -- Step 1: Check basic connectivity with /health
              local healthUrl = prefs.apiUrl .. '/health'
              local healthResponse, healthHeaders = LrHttp.get(healthUrl)

              if not healthResponse then
                LrDialogs.message('Connection Failed', 'Could not connect to the API. Please check the URL.', 'critical')
                return
              end

              -- Step 2: Verify API key by hitting an authenticated endpoint
              local authUrl = prefs.apiUrl .. '/collections'
              local authHeaders = {
                { field = 'X-API-Key', value = prefs.apiKey },
              }
              local authResponse, authRespHeaders = LrHttp.get(authUrl, authHeaders)

              if authResponse then
                -- Check if we got an auth error (401)
                if authRespHeaders and authRespHeaders.status and authRespHeaders.status == 401 then
                  LrDialogs.message('Authentication Failed', 'The API key is invalid. Please check your credentials.', 'critical')
                else
                  LrDialogs.message('Connection Successful', 'Successfully connected and authenticated with the Photo Gallery API.', 'info')
                end
              else
                LrDialogs.message('Authentication Failed', 'Could not verify API key. Please check your credentials.', 'critical')
              end
            end)
          end,
        },
      },
    },
  }
end

return PluginManager
