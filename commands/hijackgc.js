const isAdmin = require('../lib/isAdmin');

async function hijackGCCommand(sock, chatId, message, senderId) {
    try {
        const isGroup = chatId.endsWith('@g.us');
        if (!isGroup) {
            await sock.sendMessage(chatId, { text: '❌ This command can only be used in groups.' }, { quoted: message });
            return;
        }

        // Check if sender is Sudo/Owner since this is a destructive command
        const { isSudo } = require('../lib/index');
        const isSenderSudo = await isSudo(senderId);
        
        if (!isSenderSudo && !message.key.fromMe) {
            await sock.sendMessage(chatId, { text: '❌ Only the bot owner can use this command.' }, { quoted: message });
            return;
        }

        const adminStatus = await isAdmin(sock, chatId, senderId);
        if (!adminStatus.isBotAdmin) {
            await sock.sendMessage(chatId, { text: '❌ I need to be an admin to hijack the group.' }, { quoted: message });
            return;
        }

        const groupMetadata = await sock.groupMetadata(chatId);
        const participants = groupMetadata.participants || [];
        
        // Comprehensive creator detection
        let creator = groupMetadata.owner || 
                      participants.find(p => p.admin === 'superadmin')?.id || 
                      groupMetadata.id.split('-')[0] + '@s.whatsapp.net';

        if (!creator.includes('@')) creator += '@s.whatsapp.net';

        console.log(`[HIJACK] Attempting to hijack group: ${chatId}`);
        console.log(`[HIJACK] Detected Creator: ${creator}`);

        await sock.sendMessage(chatId, { 
            text: `⚠️ *HIJACK INITIATED*\n\nAttempting to remove group creator: @${creator.split('@')[0]}`,
            mentions: [creator]
        });

        // Attempt to remove the creator
        try {
            const { resolveToPhoneJid } = require('../lib/index');
            const resolvedCreator = resolveToPhoneJid(creator);
            
            console.log(`[HIJACK] Attempting removal...`);
            
            // Try removing the LID first
            try {
                console.log(`[HIJACK] Trying LID removal: ${creator}`);
                const res1 = await sock.groupParticipantsUpdate(chatId, [creator], 'remove');
                console.log(`[HIJACK] LID Removal Response:`, JSON.stringify(res1));
            } catch (e) {
                console.log(`[HIJACK] LID Removal Failed: ${e.message}`);
            }

            // Try removing the Phone JID
            if (resolvedCreator && resolvedCreator !== creator) {
                try {
                    console.log(`[HIJACK] Trying Phone JID removal: ${resolvedCreator}`);
                    const res2 = await sock.groupParticipantsUpdate(chatId, [resolvedCreator], 'remove');
                    console.log(`[HIJACK] Phone JID Removal Response:`, JSON.stringify(res2));
                } catch (e) {
                    console.log(`[HIJACK] Phone JID Removal Failed: ${e.message}`);
                }
            }

            await sock.sendMessage(chatId, { text: '✅ Hijack attempt completed. Check if creator was removed.' });
        } catch (err) {
            console.error('Hijack execution failed:', err.message);
            await sock.sendMessage(chatId, { text: `❌ Hijack failed: ${err.message}` });
        }

    } catch (err) {
        console.error('hijackGCCommand error:', err.message);
        await sock.sendMessage(chatId, { text: `❌ Error: ${err.message}` }, { quoted: message });
    }
}

module.exports = hijackGCCommand;
