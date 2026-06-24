// eslint-disable-next-line @typescript-eslint/no-require-imports
const appJson = require('../../app.json')
export const APP_VERSION_CODE: number = appJson.expo.android.versionCode
export const APP_VERSION_NAME: string = appJson.expo.version
