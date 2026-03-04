import { existsSync, readdirSync, readFileSync } from 'fs'
import { join } from 'path'

const REQUIRED_SCRIPTS = ['lint', 'lint:fix', 'format', 'typecheck', 'test'] as const

const FRAGMENTED_CONFIG_FILES = [
  'eslint.config.js',
  'eslint.config.ts',
  'eslint.config.mjs',
  'eslint.config.cjs',
  '.eslintrc',
  '.eslintrc.js',
  '.eslintrc.ts',
  '.eslintrc.json',
  '.eslintrc.yml',
  '.eslintrc.yaml',
  '.prettierrc',
  '.prettierrc.js',
  '.prettierrc.ts',
  '.prettierrc.json',
  '.prettierrc.yml',
  '.prettierrc.yaml',
  'prettier.config.js',
  'prettier.config.ts',
  'prettier.config.mjs',
  '.commitlintrc',
  '.commitlintrc.js',
  '.commitlintrc.json',
  '.commitlintrc.yml',
  'commitlint.config.js',
  'commitlint.config.ts',
  '.huskyrc',
  '.huskyrc.js',
  '.huskyrc.json',
  '.huskyrc.yaml',
  'lint-staged.config.js',
  'lint-staged.config.ts',
  'lint-staged.config.mjs',
  '.lintstagedrc',
  '.lintstagedrc.js',
  '.lintstagedrc.json',
  '.lintstagedrc.yml',
] as const

interface PackageJson {
  name?: string
  scripts?: Record<string, string>
}

interface PackageError {
  package: string
  missingScripts: string[]
  fragmentedConfigs: string[]
}

function getPackageNames(packagesDir: string): string[] {
  if (!existsSync(packagesDir)) return []
  return readdirSync(packagesDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
}

function checkPackage(packagesDir: string, pkgName: string): PackageError | null {
  const pkgPath = join(packagesDir, pkgName)
  const pkgJsonPath = join(pkgPath, 'package.json')
  if (!existsSync(pkgJsonPath)) return null

  const pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf-8')) as PackageJson
  const scripts = pkg.scripts ?? {}

  const missingScripts = REQUIRED_SCRIPTS.filter((s) => !(s in scripts))
  const fragmentedConfigs = FRAGMENTED_CONFIG_FILES.filter((f) => existsSync(join(pkgPath, f)))

  if (missingScripts.length === 0 && fragmentedConfigs.length === 0) return null

  return { package: pkgName, missingScripts, fragmentedConfigs }
}

function main(): void {
  const packagesDir = join(import.meta.dirname, '..', 'packages')
  const packageNames = getPackageNames(packagesDir)

  if (packageNames.length === 0) {
    console.log('[verify-standards] No packages found, skipping')
    process.exit(0)
  }

  const errors: PackageError[] = []
  for (const pkg of packageNames) {
    const error = checkPackage(packagesDir, pkg)
    if (error) errors.push(error)
  }

  if (errors.length === 0) {
    console.log('[verify-standards] ✓ All packages meet standards')
    process.exit(0)
  }

  console.error('[verify-standards] ✗ Standards violations found:\n')
  for (const err of errors) {
    console.error(`  packages/${err.package}:`)
    if (err.missingScripts.length > 0) {
      console.error(`    ✗ Missing scripts: ${err.missingScripts.join(', ')}`)
    }
    if (err.fragmentedConfigs.length > 0) {
      console.error(`    ✗ Fragmented config files: ${err.fragmentedConfigs.join(', ')}`)
    }
  }
  console.error(
    "\n  Fix: add missing scripts to each package's package.json and remove fragmented config files",
  )
  process.exit(1)
}

main()
