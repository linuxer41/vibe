import { json } from '@sveltejs/kit';
import { listVersions } from '$lib/binaries';

export async function GET() {
	return json(listVersions());
}
