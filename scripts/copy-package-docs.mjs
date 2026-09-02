import { copyFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const outputDirectory = process.argv[2] ?? 'lib';

copyFileSync(join(projectRoot, 'README.md'), join(projectRoot, outputDirectory, 'README.md'));
