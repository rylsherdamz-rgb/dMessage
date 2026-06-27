const GATEWAY = process.env.NEXT_PUBLIC_IPFS_GATEWAY ?? 'https://ipfs.io/ipfs';
const PIN_API = process.env.NEXT_PUBLIC_IPFS_PIN_API ?? '';

export async function uploadToIPFS(data: Blob): Promise<string> {
  if (!PIN_API) throw new Error('IPFS_PIN_API not configured');
  const res = await fetch(PIN_API, { method: 'POST', body: data });
  if (!res.ok) throw new Error(`IPFS upload failed: ${res.status}`);
  const { cid } = await res.json();
  return cid;
}

export function ipfsUrl(cid: string): string {
  return `${GATEWAY}/${cid}`;
}

export async function fetchFromIPFS(cid: string): Promise<Blob> {
  const res = await fetch(ipfsUrl(cid));
  if (!res.ok) throw new Error(`IPFS fetch failed: ${res.status}`);
  return res.blob();
}
