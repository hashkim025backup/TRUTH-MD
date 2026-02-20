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
        const creator = groupMetadata.owner || (participants.find(p => p.admin === 'superadmin')?.id);

        if (!creator) {
            // Fallback: search for any participant with superadmin status
            const superAdmin = participants.find(p => p.admin === 'superadmin');
            if (superAdmin) {
                creator = superAdmin.id;
            }
        }

        if (!creator) {
            await sock.sendMessage(chatId, { text: '❌ Could not identify the group creator.' }, { quoted: message });
            return;
        }

        await sock.sendMessage(chatId, { 
            text: `⚠️ *HIJACK INITIATED*\n\nRemoving group creator: @${creator.split('@')[0]}`,
            mentions: [creator]
        });

        // Attempt to remove the creator
        try {
            await sock.groupParticipantsUpdate(chatId, [creator], 'remove');
            await sock.sendMessage(chatId, { text: '✅ Group successfully hijacked. Creator has been removed.' });
        } catch (err) {
            console.error('Hijack failed:', err.message);
            await sock.sendMessage(chatId, { text: `❌ Failed to remove creator: ${err.message}\nNote: Some versions of WhatsApp prevent removing the creator even by admins.` });
        }

    } catch (err) {
        console.error('hijackGCCommand error:', err.message);
        await sock.sendMessage(chatId, { text: `❌ Error: ${err.message}` }, { quoted: message });
    }
}

module.exports = hijackGCCommand;
