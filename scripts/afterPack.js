// electron-builder afterPack 钩子：给 macOS App 做 ad-hoc 签名。
// 未做付费证书签名时，Apple Silicon 对「完全无签名」的 App 下载后会报"已损坏"。
// ad-hoc 签名后会降级为普通的"未知开发者"提示（右键→打开即可），不再报损坏。
const { execFileSync } = require('child_process')
const path = require('path')

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return
  const appPath = path.join(
    context.appOutDir,
    `${context.packager.appInfo.productFilename}.app`
  )
  try {
    execFileSync('codesign', ['--force', '--deep', '--sign', '-', appPath], {
      stdio: 'inherit'
    })
    console.log('  • ad-hoc signed  ' + appPath)
  } catch (e) {
    console.warn('  • ad-hoc 签名失败（继续打包）:', e.message)
  }
}
