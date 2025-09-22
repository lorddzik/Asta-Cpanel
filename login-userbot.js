const { TelegramClient } = require("telegram"); //
const { StringSession } = require("telegram/sessions"); //
const input = require("input"); 

(async () => {
  console.log("Memulai proses login Userbot...");

  const apiId = parseInt(await input.text("Masukkan API ID Anda: "));
  const apiHash = await input.text("Masukkan API Hash Anda: ");
  const stringSession = new StringSession("");

  const client = new TelegramClient(stringSession, apiId, apiHash, {
    connectionRetries: 5,
  });

  await client.start({
    phoneNumber: async () => await input.text("Masukkan nomor telepon Anda: "),
    password: async () => await input.text("Masukkan kata sandi 2FA Anda (jika ada): "),
    phoneCode: async () => await input.text("Masukkan kode yang Anda terima: "),
    onError: (err) => console.log(err),
  });

  console.log("\nAnda telah berhasil login!");
  console.log("Simpan string sesi ini di file setting.js Anda.");
  console.log("========================= SESSION STRING =========================");
  console.log(client.session.save());
  console.log("==================================================================");
  
  await client.disconnect();
})();