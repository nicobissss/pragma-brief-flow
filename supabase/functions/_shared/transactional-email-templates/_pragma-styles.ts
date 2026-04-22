// Shared Pragma brand styling for transactional email templates.
// Mirror the style of auth emails (recovery.tsx) for consistency.

export const PRAGMA_ADMIN_EMAILS = ['dev@pragmarketers.com'];

export const styles = {
  main: { backgroundColor: '#ffffff', fontFamily: "'Inter', Arial, sans-serif", padding: '40px 20px' },
  container: { maxWidth: '560px', margin: '0 auto' },
  card: { backgroundColor: '#F5F2EC', borderRadius: '16px', padding: '32px 28px', border: '1px solid #D9D3C8' },
  h1: { fontSize: '22px', fontWeight: 'bold' as const, color: '#1A1C22', margin: '0 0 20px' },
  h2: { fontSize: '16px', fontWeight: '600' as const, color: '#1A1C22', margin: '0 0 12px' },
  text: { fontSize: '15px', color: '#1A1C22', lineHeight: '1.6', margin: '0 0 18px' },
  button: { backgroundColor: '#7BB8D4', color: '#ffffff', fontSize: '15px', fontWeight: '600' as const, borderRadius: '12px', padding: '14px 28px', textDecoration: 'none', display: 'inline-block', margin: '8px 0 24px' },
  meta: { fontSize: '13px', color: '#707480', margin: '8px 0', lineHeight: '1.5' },
  footer: { fontSize: '13px', color: '#707480', margin: '20px 0 0', lineHeight: '1.5' },
  signature: { fontSize: '12px', color: '#707480', textAlign: 'center' as const, margin: '24px 0 0' },
  highlight: { backgroundColor: '#ffffff', borderRadius: '8px', padding: '12px 16px', border: '1px solid #D9D3C8', margin: '12px 0', fontSize: '14px', color: '#1A1C22' },
};
