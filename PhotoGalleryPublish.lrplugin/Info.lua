return {
  LrSdkVersion = 13.0,
  LrSdkMinimumVersion = 6.0,
  LrToolkitIdentifier = 'com.photogallery.publish',
  LrPluginName = 'Photo Gallery Publish',
  LrPluginInfoUrl = 'https://github.com/your-repo/photo-gallery',

  LrPluginInfoProvider = 'PluginManager.lua',
  LrExportServiceProvider = {
    title = 'Photo Gallery',
    file = 'PublishServiceProvider.lua',
  },
  LrPublishServiceProvider = {
    title = 'Photo Gallery',
    file = 'PublishServiceProvider.lua',
  },

  VERSION = { major = 1, minor = 0, revision = 0, build = 1 },
}
