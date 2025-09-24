export function toSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export function formatPackageName(projectName: string): string {
  const slug = toSlug(projectName);
  return slug || 'template-api';
}

export function defaultTargetDirectory(projectName?: string): string {
  const baseName = projectName ?? '';
  const slug = toSlug(baseName);
  return `./${slug || 'mon-api'}`;
}
