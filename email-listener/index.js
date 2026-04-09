const { google } = require('googleapis');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const CREDENTIALS_PATH = path.join(__dirname, 'credentials.json');
const TOKEN_PATH       = path.join(__dirname, 'token.json');
const PROCESSED_PATH   = path.join(__dirname, 'processed.json');
const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly', 'https://www.googleapis.com/auth/gmail.send'];

const CAP_API_URL   = process.env.CAP_API_URL;
const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL || '60000');

const XSUAA_URL     = 'https://e32c7822trial.authentication.us10.hana.ondemand.com';
const CLIENT_ID     = 'sb-ticket-intelligence-sys-e32c7822trial-dev!t616283';
const CLIENT_SECRET = process.env.XSUAA_CLIENT_SECRET || 'your_secret_here';

let cachedToken = null;
let tokenExpiry = null;

function getProcessed() {
    if (fs.existsSync(PROCESSED_PATH)) return new Set(JSON.parse(fs.readFileSync(PROCESSED_PATH)));
    return new Set();
}

function saveProcessed(ids) {
    fs.writeFileSync(PROCESSED_PATH, JSON.stringify([...ids]));
}

async function getXsuaaToken() {
    if (cachedToken && tokenExpiry && Date.now() < tokenExpiry) return cachedToken;
    const response = await axios.post(
        `${XSUAA_URL}/oauth/token`,
        'grant_type=client_credentials',
        {
            auth: { username: CLIENT_ID, password: CLIENT_SECRET },
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        }
    );
    cachedToken = response.data.access_token;
    tokenExpiry = Date.now() + (response.data.expires_in - 60) * 1000;
    console.log('✅ XSUAA token obtained');
    return cachedToken;
}

async function authenticate() {
    const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH));
    const { client_secret, client_id, redirect_uris } = credentials.installed;
    const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
    if (fs.existsSync(TOKEN_PATH)) {
        oAuth2Client.setCredentials(JSON.parse(fs.readFileSync(TOKEN_PATH)));
        return oAuth2Client;
    }
    const authUrl = oAuth2Client.generateAuthUrl({ access_type: 'offline', scope: SCOPES });
    console.log('\n🔐 Authorize this app by visiting:\n', authUrl);
    if (process.env.AUTH_CODE) {
        const { tokens } = await oAuth2Client.getToken(process.env.AUTH_CODE);
        oAuth2Client.setCredentials(tokens);
        fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens));
        console.log('✅ Token saved');
        return oAuth2Client;
    }
    process.exit(0);
}

async function getSupportEmails(auth) {
    const gmail = google.gmail({ version: 'v1', auth });
    const res = await gmail.users.messages.list({
        userId: 'me',
        q: 'subject:[SUPPORT]',
        maxResults: 50
    });
    return res.data.messages || [];
}

async function getEmailDetails(auth, messageId) {
    const gmail = google.gmail({ version: 'v1', auth });
    const res = await gmail.users.messages.get({ userId: 'me', id: messageId, format: 'full' });
    const headers = res.data.payload.headers;
    const subject = headers.find(h => h.name === 'Subject')?.value || '';
    const from    = headers.find(h => h.name === 'From')?.value || 'Unknown';
    const date    = headers.find(h => h.name === 'Date')?.value || '';

    let body = '';
    const payload = res.data.payload;
    if (payload.body?.data) {
        body = Buffer.from(payload.body.data, 'base64').toString('utf-8');
    } else if (payload.parts) {
        for (const part of payload.parts) {
            if (part.mimeType === 'text/plain' && part.body?.data) {
                body = Buffer.from(part.body.data, 'base64').toString('utf-8');
                break;
            }
        }
    }

    // Keep original subject for filtering, clean title for ticket
    const title = subject.replace('[SUPPORT]', '').trim();
    return { id: messageId, subject, title, description: body.trim(), from, date };
}

async function createTicket(email) {
    const token = await getXsuaaToken();
    const response = await axios.post(
        `${CAP_API_URL}/odata/v4/support/createTicketFromEmail`,
        {
            title:       email.title || 'Support Request',
            description: `From: ${email.from}\nDate: ${email.date}\n\n${email.description}`
        },
        {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            timeout: 30000
        }
    );
    return response.data;
}

async function pollEmails(auth) {
    console.log(`\n📧 Polling Gmail for [SUPPORT] emails...`);
    const processed = getProcessed();

    try {
        const messages = await getSupportEmails(auth);
        const newMessages = messages.filter(m => !processed.has(m.id));

        if (newMessages.length === 0) {
            console.log('   No new support emails.');
            return;
        }

        console.log(`   Found ${newMessages.length} unprocessed email(s)`);

        for (const message of newMessages) {
            try {
                const email = await getEmailDetails(auth, message.id);

                // ✅ STRICT filter — subject must contain exactly [SUPPORT]
                if (!email.subject.includes('[SUPPORT]')) {
                    console.log(`   ⏭️  Skipping: "${email.subject}" (no [SUPPORT] tag)`);
                    processed.add(message.id);
                    saveProcessed(processed);
                    continue;
                }

                console.log(`\n📨 "${email.title}" from ${email.from}`);
                const ticket = await createTicket(email);
                console.log(`   ✅ Ticket created: ${ticket.ID}`);
                processed.add(message.id);
                saveProcessed(processed);
            } catch (err) {
                console.error(`   ❌ Error:`, err.response?.data || err.message);
            }
        }
    } catch (err) {
        console.error('❌ Poll error:', err.message);
    }
}

async function main() {
    console.log('🚀 Email Listener starting...');
    console.log(`   CAP API: ${CAP_API_URL}`);
    console.log(`   Poll every: ${POLL_INTERVAL / 1000}s`);
    const auth = await authenticate();
    console.log('✅ Gmail authenticated');
    await pollEmails(auth);
    setInterval(() => pollEmails(auth), POLL_INTERVAL);
}

main().catch(console.error);
