/** Saves text as a download (the HTML report, "Export test cases"). */
export function download(
  fileName: string,
  text: string,
  mime = 'text/plain',
  urlApi: Pick<typeof URL, 'createObjectURL' | 'revokeObjectURL'> = URL,
): void {
  const url = urlApi.createObjectURL(new Blob([text], { type: `${mime};charset=utf-8` }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  urlApi.revokeObjectURL(url);
}
