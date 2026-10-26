export type PayloadType = 'URL' | 'UPI payment' | 'Wi-Fi' | 'Contact' | 'Text' | 'App intent';
export type Verdict = 'Safe' | 'Caution' | 'Do not proceed';
export type Analysis = { payload: string; type: PayloadType; score: number; verdict: Verdict; reasons: string[]; details: Record<string, string>; shortened: boolean };

const shorteners = new Set(['bit.ly','t.co','tinyurl.com','goo.gl','t.ly','is.gd','ow.ly','buff.ly','cutt.ly','rebrand.ly','shorturl.at','rb.gy']);
const brands = ['google.com','paypal.com','paytm.com','phonepe.com','amazon.in','amazon.com','apple.com','microsoft.com','sbi.co.in','hdfcbank.com','icicibank.com','axisbank.com','gpay.google.com'];
const suspiciousTlds = new Set(['top','xyz','tk','ml','ga','cf','gq','click','zip','mov']);

function levenshtein(a: string, b: string) {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) { let prev = row[0]; row[0] = i; for (let j = 1; j <= b.length; j++) { const old = row[j]; row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = old; } }
  return row[b.length];
}
function domainOf(url: URL) { return url.hostname.toLowerCase().replace(/^www\./, ''); }
function brandLookalike(host: string) {
  const labels = host.split('.');
  const candidate = labels.length >= 2 ? labels.at(-2)! + '.' + labels.at(-1) : host;
  for (const brand of brands) {
    const root = brand.split('.').slice(-2).join('.');
    if (candidate === root || host === brand) continue;
    const brandName = root.split('.')[0];
    const cName = labels.at(-2) || host;
    if ((levenshtein(cName, brandName) <= 2 && Math.abs(cName.length - brandName.length) <= 2) || (host.includes(brandName) && host !== brand)) return `${host} resembles ${brand}`;
  }
  return '';
}
export function analyzePayload(raw: string): Analysis {
  const payload = raw.trim(); let type: PayloadType = 'Text'; let score = 0; const reasons: string[] = []; const details: Record<string,string> = {}; let shortened = false;
  if (/^upi:\/\/pay(?:\?|$)/i.test(payload)) {
    type = 'UPI payment'; const q = payload.slice(payload.indexOf('?') + 1); const params = new URLSearchParams(q);
    const pa = params.get('pa') || ''; const pn = params.get('pn') || ''; const am = params.get('am') || ''; const tn = params.get('tn') || ''; const mc = params.get('mc') || '';
    Object.assign(details, { 'Payee name': pn || 'Not provided', 'UPI ID (VPA)': pa || 'Not provided', Amount: am ? `${params.get('cu') || 'INR'} ${am}` : 'Not pre-filled', Note: tn || 'None', 'Merchant code': mc || 'Not provided' });
    if (!pa) { score += 20; reasons.push('Payment link has no payee UPI ID.'); }
    const payee = pn.toLowerCase().replace(/[^a-z0-9]/g,''); const handle = pa.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g,'');
    if (payee && handle && payee.length > 2 && !payee.includes(handle) && !handle.includes(payee)) {
      score += 30; reasons.push('Payee name and UPI ID do not clearly match. Confirm the recipient independently.');
      if (/swiggy|zomato|paytm|phonepe|googlepay|gpay|amazon|electricityboard|merchant|restaurant|store|shop/i.test(pn)) { score += 20; reasons.push('A business or known brand name is paired with an unrelated UPI ID.'); }
    }
    if (am) { const amount = Number(am); if (Number.isFinite(amount) && amount >= 1000) score += 10; reasons.push(`A payment amount of ${params.get('cu') || 'INR'} ${am} is pre-filled. Check it before approving.`); }
    if (pn && /shop|store|market|restaurant|cafe|merchant|board|company/i.test(pn) && /^[a-z0-9._-]{7,}@(?:ok|ybl|ibl|axl|paytm|upi)/i.test(pa) && !payee.includes(handle.slice(0,5))) { score += 15; reasons.push('This may be a personal UPI ID presented as a business.'); }
    if (!reasons.length) reasons.push('Review the payee and amount in your payment app before approving.');
  } else if (/^wifi:/i.test(payload)) {
    type = 'Wi-Fi'; const fields = Object.fromEntries(payload.replace(/^WIFI:/i,'').replace(/;$/,'').split(';').map(x => { const at=x.indexOf(':'); return at < 0 ? [x,''] : [x.slice(0,at),x.slice(at+1)]; }));
    Object.assign(details, { SSID: fields.S || 'Not provided', Security: fields.T || 'Unknown', Hidden: fields.H || 'false', Password: fields.P ? 'Present (hidden)' : 'None' }); reasons.push('Wi-Fi details are shown for review. This app will never join a network for you.'); score = 10;
  } else if (/^(https?:\/\/)/i.test(payload)) {
    type = 'URL';
    try {
      const url = new URL(payload); const host = domainOf(url); details['Destination domain'] = host; details['Full URL'] = payload;
      shortened = shorteners.has(host); if (shortened) { score += 20; reasons.push('This is a shortened link; its final destination has not been checked.'); }
      if (url.protocol !== 'https:') { score += 15; reasons.push('This link does not use HTTPS.'); }
      if (url.username || url.password || payload.includes('@')) { score += 20; reasons.push('The URL contains an @ sign or embedded credentials that can disguise its destination.'); }
      if (/^(\d{1,3}\.){3}\d{1,3}$/.test(url.hostname) || url.hostname.startsWith('[')) { score += 20; reasons.push('This link uses an IP address instead of a recognizable domain.'); }
      if (url.hostname.startsWith('xn--') || url.hostname.split('.').some(x=>x.startsWith('xn--'))) { score += 20; reasons.push('This domain uses encoded characters that can imitate another domain.'); }
      const look = brandLookalike(host); if (look) { score += 30; reasons.push(`Possible brand impersonation: ${look}.`); }
      const tld = host.split('.').at(-1) || ''; if (suspiciousTlds.has(tld)) { score += 15; reasons.push(`The .${tld} domain ending is commonly used in suspicious links.`); }
      if (url.hostname.split('.').length > 4) { score += 10; reasons.push('This address has an unusually large number of subdomains.'); }
      if (/[?&][^=]+=.{32,}/.test(payload)) { score += 10; reasons.push('The link contains unusually long encoded parameters.'); }
      if (!reasons.length) reasons.push('No obvious URL warning was detected. Destination reputation and redirect history were not checked.');
    } catch { score += 30; reasons.push('This link could not be parsed as a valid web address.'); }
  } else if (/^intent:/i.test(payload)) { type = 'App intent'; score = 25; reasons.push('This link can ask another app to open. Review it carefully; no app will be launched here.'); }
  else if (/^(smsto:|tel:|mailto:)/i.test(payload)) { type='Contact'; const i=payload.indexOf(':'); details['Action preview']=payload.slice(i+1).replace(/^\/\//,''); reasons.push('This is a contact action. Check the address or number before using it.'); }
  else if (/^begin:vcard/i.test(payload)) { type='Contact'; for (const line of payload.split(/\r?\n/)) { const [k,...v]=line.split(':'); if (['FN','N','TEL','EMAIL','ORG'].includes(k.toUpperCase())) details[k.toUpperCase()]=v.join(':'); } reasons.push('Contact details are displayed for review. Nothing will be added automatically.'); }
  else if (/https?:\/\//i.test(payload)) { type='Text'; reasons.push('This text contains a web address. It is shown as text and will not be opened.'); }
  const verdict: Verdict = score >= 50 ? 'Do not proceed' : score >= 20 ? 'Caution' : 'Safe';
  return { payload, type, score: Math.min(score,100), verdict, reasons, details, shortened };
}
