import { error } from '@sveltejs/kit';
import { getBinary } from '$lib/binaries';

export async function GET({ params }) {
	const { platform, arch } = params;
	const result = getBinary(platform, arch);

	if (!result) {
		error(404, 'Binary not found');
	}

	const { stream, info } = result;

	return new Response(stream as any, {
		headers: {
			'content-type': 'application/octet-stream',
			'content-disposition': `attachment; filename="${info.filename}"`,
			'content-length': String(info.size),
			'x-sha256': info.sha256,
		},
	});
}
