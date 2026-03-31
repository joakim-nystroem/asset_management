// AuditLayout companion — date formatting helper

export function formatDate(val: Date | string | null): string {
	if (!val) return '\u2014';
	const d = val instanceof Date ? val : new Date(val);
	return d.toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' });
}
