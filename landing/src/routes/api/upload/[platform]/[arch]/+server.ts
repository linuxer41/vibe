import { json, error } from '@sveltejs/kit';
import { saveBinary } from '$lib/binaries';

const UPLOAD_SECRET = process.env.UPLOAD_SECRET || '123456789';

export async function POST({ request, params }) {
	if (UPLOAD_SECRET) {
		const auth = request.headers.get('authorization');
		if (auth !== `Bearer ${UPLOAD_SECRET}`) {
			error(401, 'Unauthorized');
		}
	}

	const { platform, arch } = params;
	const buffer = Buffer.from(await request.arrayBuffer());
	const disposition = request.headers.get('content-disposition') || '';
	const match = disposition.match(/filename\s*=\s*"?([^"]+)"?/i);
	const filename = match?.[1] || `${platform}-${arch}.bin`;

	if (buffer.length === 0) {
		error(400, 'Empty body');
	}

	const info = saveBinary(platform, arch, filename, buffer);
	return json(info, { status: 201 });
}
