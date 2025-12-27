-- Simple JSON encoder/decoder for Lightroom plugins
-- Based on Jeffrey Friedl's JSON library

local JSON = { _version = "1.0" }

local function encode_value(val)
  local t = type(val)

  if t == "nil" then
    return "null"
  elseif t == "boolean" then
    return val and "true" or "false"
  elseif t == "number" then
    if val ~= val then
      return "null" -- NaN
    elseif val >= math.huge then
      return "null" -- Infinity
    elseif val <= -math.huge then
      return "null" -- -Infinity
    else
      return tostring(val)
    end
  elseif t == "string" then
    -- Escape special characters
    val = val:gsub('\\', '\\\\')
    val = val:gsub('"', '\\"')
    val = val:gsub('\n', '\\n')
    val = val:gsub('\r', '\\r')
    val = val:gsub('\t', '\\t')
    return '"' .. val .. '"'
  elseif t == "table" then
    -- Check if array or object
    local isArray = true
    local maxIndex = 0
    for k, v in pairs(val) do
      if type(k) ~= "number" or k < 1 or math.floor(k) ~= k then
        isArray = false
        break
      end
      if k > maxIndex then maxIndex = k end
    end

    if isArray and maxIndex > 0 then
      -- Array
      local parts = {}
      for i = 1, maxIndex do
        parts[i] = encode_value(val[i])
      end
      return "[" .. table.concat(parts, ",") .. "]"
    else
      -- Object
      local parts = {}
      for k, v in pairs(val) do
        if type(k) == "string" then
          table.insert(parts, encode_value(k) .. ":" .. encode_value(v))
        end
      end
      return "{" .. table.concat(parts, ",") .. "}"
    end
  else
    return "null"
  end
end

function JSON:encode(val)
  return encode_value(val)
end

-- Simple JSON decoder
local function skip_whitespace(str, pos)
  while pos <= #str do
    local c = str:sub(pos, pos)
    if c == ' ' or c == '\t' or c == '\n' or c == '\r' then
      pos = pos + 1
    else
      break
    end
  end
  return pos
end

-- Convert Unicode codepoint to UTF-8 string
local function codepoint_to_utf8(codepoint)
  if codepoint < 0x80 then
    return string.char(codepoint)
  elseif codepoint < 0x800 then
    return string.char(
      0xC0 + math.floor(codepoint / 0x40),
      0x80 + (codepoint % 0x40)
    )
  elseif codepoint < 0x10000 then
    return string.char(
      0xE0 + math.floor(codepoint / 0x1000),
      0x80 + (math.floor(codepoint / 0x40) % 0x40),
      0x80 + (codepoint % 0x40)
    )
  elseif codepoint < 0x110000 then
    return string.char(
      0xF0 + math.floor(codepoint / 0x40000),
      0x80 + (math.floor(codepoint / 0x1000) % 0x40),
      0x80 + (math.floor(codepoint / 0x40) % 0x40),
      0x80 + (codepoint % 0x40)
    )
  else
    return "?" -- Invalid codepoint
  end
end

-- Parse \uXXXX escape sequence, returns codepoint and new position
local function parse_unicode_escape(str, pos)
  local hex = str:sub(pos, pos + 3)
  if #hex < 4 then
    return nil, pos
  end
  local codepoint = tonumber(hex, 16)
  if not codepoint then
    return nil, pos
  end
  return codepoint, pos + 4
end

local decode_value -- forward declaration

local function decode_string(str, pos)
  pos = pos + 1 -- skip opening quote
  local result = ""
  while pos <= #str do
    local c = str:sub(pos, pos)
    if c == '"' then
      return result, pos + 1
    elseif c == '\\' then
      pos = pos + 1
      local escaped = str:sub(pos, pos)
      if escaped == 'n' then
        result = result .. '\n'
        pos = pos + 1
      elseif escaped == 'r' then
        result = result .. '\r'
        pos = pos + 1
      elseif escaped == 't' then
        result = result .. '\t'
        pos = pos + 1
      elseif escaped == '"' then
        result = result .. '"'
        pos = pos + 1
      elseif escaped == '\\' then
        result = result .. '\\'
        pos = pos + 1
      elseif escaped == '/' then
        result = result .. '/'
        pos = pos + 1
      elseif escaped == 'b' then
        result = result .. '\b'
        pos = pos + 1
      elseif escaped == 'f' then
        result = result .. '\f'
        pos = pos + 1
      elseif escaped == 'u' then
        -- Unicode escape: \uXXXX
        pos = pos + 1
        local codepoint, newPos = parse_unicode_escape(str, pos)
        if codepoint then
          -- Check for surrogate pair (emoji and other chars > U+FFFF)
          if codepoint >= 0xD800 and codepoint <= 0xDBFF then
            -- High surrogate - look for low surrogate
            if str:sub(newPos, newPos + 1) == '\\u' then
              local lowCodepoint, finalPos = parse_unicode_escape(str, newPos + 2)
              if lowCodepoint and lowCodepoint >= 0xDC00 and lowCodepoint <= 0xDFFF then
                -- Combine surrogate pair into actual codepoint
                codepoint = 0x10000 + (codepoint - 0xD800) * 0x400 + (lowCodepoint - 0xDC00)
                newPos = finalPos
              end
            end
          end
          result = result .. codepoint_to_utf8(codepoint)
          pos = newPos
        else
          -- Invalid unicode escape, keep as literal
          result = result .. 'u'
          pos = pos
        end
      else
        result = result .. escaped
        pos = pos + 1
      end
    else
      result = result .. c
      pos = pos + 1
    end
  end
  error("Unterminated string")
end

local function decode_number(str, pos)
  local startPos = pos
  while pos <= #str do
    local c = str:sub(pos, pos)
    if c:match('[%d%.eE%+%-]') then
      pos = pos + 1
    else
      break
    end
  end
  return tonumber(str:sub(startPos, pos - 1)), pos
end

local function decode_array(str, pos)
  pos = pos + 1 -- skip [
  local result = {}
  pos = skip_whitespace(str, pos)

  if str:sub(pos, pos) == ']' then
    return result, pos + 1
  end

  while true do
    local val
    val, pos = decode_value(str, pos)
    table.insert(result, val)
    pos = skip_whitespace(str, pos)
    local c = str:sub(pos, pos)
    if c == ']' then
      return result, pos + 1
    elseif c == ',' then
      pos = pos + 1
      pos = skip_whitespace(str, pos)
    else
      error("Expected ',' or ']' in array")
    end
  end
end

local function decode_object(str, pos)
  pos = pos + 1 -- skip {
  local result = {}
  pos = skip_whitespace(str, pos)

  if str:sub(pos, pos) == '}' then
    return result, pos + 1
  end

  while true do
    pos = skip_whitespace(str, pos)
    if str:sub(pos, pos) ~= '"' then
      error("Expected string key in object")
    end
    local key
    key, pos = decode_string(str, pos)
    pos = skip_whitespace(str, pos)
    if str:sub(pos, pos) ~= ':' then
      error("Expected ':' after key")
    end
    pos = pos + 1
    pos = skip_whitespace(str, pos)
    local val
    val, pos = decode_value(str, pos)
    result[key] = val
    pos = skip_whitespace(str, pos)
    local c = str:sub(pos, pos)
    if c == '}' then
      return result, pos + 1
    elseif c == ',' then
      pos = pos + 1
    else
      error("Expected ',' or '}' in object")
    end
  end
end

decode_value = function(str, pos)
  pos = skip_whitespace(str, pos)
  local c = str:sub(pos, pos)

  if c == '"' then
    return decode_string(str, pos)
  elseif c == '{' then
    return decode_object(str, pos)
  elseif c == '[' then
    return decode_array(str, pos)
  elseif c == 't' then
    if str:sub(pos, pos + 3) == 'true' then
      return true, pos + 4
    end
  elseif c == 'f' then
    if str:sub(pos, pos + 4) == 'false' then
      return false, pos + 5
    end
  elseif c == 'n' then
    if str:sub(pos, pos + 3) == 'null' then
      return nil, pos + 4
    end
  elseif c:match('[%d%-]') then
    return decode_number(str, pos)
  end

  error("Invalid JSON at position " .. pos)
end

function JSON:decode(str)
  if not str or str == '' then
    return nil
  end
  local result, pos = decode_value(str, 1)
  return result
end

return JSON
