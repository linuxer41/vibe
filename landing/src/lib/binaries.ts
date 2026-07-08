import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

const BINARIES_DIR = process.env.BINARIES_DIR || path.resolve('binaries');

export interface BinaryInfo {
	platform: string;
	arch: string;
	filename: string;
	size: number;
	sha256: string;
	uploadedAt: string;
}

function ensureDir() {
	if (!fs.existsSync(BINARIES_DIR)) {
		fs.mkdirSync(BINARIES_DIR, { recursive: true });
	}
}

function platformDir(platform: string, arch: string): string {
	return path.join(BINARIES_DIR, platform, arch);
}

function ensurePlatformDir(platform: string, arch: string): string {
	const dir = platformDir(platform, arch);
	if (!fs.existsSync(dir)) {
		fs.mkdirSync(dir, { recursive: true });
	}
	return dir;
}

function infoPath(platform: string, arch: string): string {
	return path.join(platformDir(platform, arch), '.info.json');
}

export function saveBinary(
	platform: string,
	arch: string,
	filename: string,
	buffer: Buffer
): BinaryInfo {
	const dir = ensurePlatformDir(platform, arch);
	const filePath = path.join(dir, filename);
	fs.writeFileSync(filePath, buffer);

	const sha256 = crypto(buffer);
	const info: BinaryInfo = {
		platform,
		arch,
		filename,
		size: buffer.length,
		sha256,
		uploadedAt: new Date().toISOString(),
	};

	fs.writeFileSync(infoPath(platform, arch), JSON.stringify(info, null, 2));
	return info;
}

function crypto(buffer: Buffer): string {
	return createHash('sha256').update(buffer).digest('hex');
}

export function getBinary(platform: string, arch: string): { stream: fs.ReadStream; info: BinaryInfo } | null {
	const infoFile = infoPath(platform, arch);
	if (!fs.existsSync(infoFile)) return null;

	const info: BinaryInfo = JSON.parse(fs.readFileSync(infoFile, 'utf-8'));
	const filePath = path.join(platformDir(platform, arch), info.filename);
	if (!fs.existsSync(filePath)) return null;

	return { stream: fs.createReadStream(filePath), info };
}

export function listVersions(): Record<string, Record<string, BinaryInfo>> {
	ensureDir();
	const result: Record<string, Record<string, BinaryInfo>> = {};
	const platforms = fs.readdirSync(BINARIES_DIR);
	for (const platform of platforms) {
		const platformPath = path.join(BINARIES_DIR, platform);
		if (!fs.statSync(platformPath).isDirectory()) continue;
		const archs = fs.readdirSync(platformPath);
		for (const arch of archs) {
			const infoFile = path.join(platformPath, arch, '.info.json');
			if (fs.existsSync(infoFile)) {
				const info: BinaryInfo = JSON.parse(fs.readFileSync(infoFile, 'utf-8'));
				if (!result[platform]) result[platform] = {};
				result[platform][arch] = info;
			}
		}
	}
	return result;
}
