import whatsappWeb from "whatsapp-web.js";
import qrcode from "qrcode-terminal";

const { Client, LocalAuth } = whatsappWeb;

const client = new Client({
  authStrategy: new LocalAuth(),
});

// Objek untuk menyimpan data nota per pengirim (message.from)
const notaData = {};

client.on("qr", (qr) => {
  qrcode.generate(qr, { small: true });
});

client.on("ready", () => {
  console.log("Bot siap dan terhubung ke WhatsApp Web!");
});

// Fungsi untuk mengirim pesan dengan delay acak antara 3 hingga 5 detik
function sendDelayed(to, text) {
  const randomDelay = Math.floor(Math.random() * (5000 - 3000 + 1)) + 3000;
  setTimeout(() => {
    client.sendMessage(to, text);
  }, randomDelay);
}

client.on("message", (message) => {
  const bodyLower = message.body.toLowerCase();

  // Handler untuk perintah /bantuan
  if (bodyLower.startsWith("/bantuan")) {
    sendDelayed(
      message.from,
      `Halo! Berikut cara menggunakan bot ini:
1. Ketik \`/nota NamaToko\` untuk memulai pembuatan nota pembelian.
   Setelah itu, masukkan nama penerima pembelian.
   Kemudian, kirimkan daftar item dengan format:
     Nama Item, Harga, Jumlah
     Contoh:
     Apel, 5000, 2
     Pisang, 3000, 5

2. Atau, gunakan shortcut:
   \`/notajadi NamaToko; Penerima; Nama Item, Harga, Jumlah\`
   (Gunakan titik koma (;) sebagai pemisah antara toko, penerima, dan daftar item.
   Jika ada lebih dari satu item, pisahkan dengan baris baru.)

Jika ada pertanyaan, silakan hubungi admin.`
    );
    return;
  }

  // Handler untuk shortcut /notajadi
  if (bodyLower.startsWith("/notajadi")) {
    let shortcutContent = message.body.substring(9).trim();
    let parts = shortcutContent.split(";");
    if (parts.length < 3) {
      sendDelayed(
        message.from,
        "Format shortcut salah. Gunakan format: /notajadi NamaToko; Penerima; Item1, Harga, Jumlah [baris baru untuk item lainnya]."
      );
      return;
    }
    let storeName = parts[0].trim();
    let receiver = parts[1].trim();
    let itemsInput = parts.slice(2).join(";").trim();

    let items = parseItems(itemsInput);
    if (!items) {
      sendDelayed(
        message.from,
        "Format input item salah. Harap gunakan format: Nama Item, Harga, Jumlah."
      );
      return;
    }

    let notaText = `=== NOTA PEMBELIAN ===\nToko: ${storeName}\nPenerima: ${receiver}\nTanggal: ${new Date().toLocaleString()}\n\n`;
    items.forEach((item) => {
      const itemTotal = item.price * item.quantity;
      notaText += `${item.name} (x${item.quantity}) - Rp ${itemTotal} 💰\n`;
    });
    const totalAmount = items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );
    notaText += `\nTotal: Rp ${totalAmount} 💸`;
    notaText += "\n=====================\nTerima kasih atas pembelian Anda! 🙏";

    sendDelayed(message.from, notaText);
    return;
  }

  // Jika pesan dimulai dengan /nota, ambil nama toko dan minta input penerima
  if (bodyLower.startsWith("/nota")) {
    let command = message.body.split(" ");
    if (command.length > 1) {
      let storeName = command.slice(1).join(" ");
      notaData[message.from] = {
        storeName: storeName,
        receiver: null,
        stage: "waiting_for_receiver",
      };
      sendDelayed(
        message.from,
        `Baik, toko "${storeName}" telah terdaftar.\nSilakan masukkan nama penerima pembelian.`
      );
    } else {
      sendDelayed(
        message.from,
        "Tolong masukkan nama toko setelah perintah /nota, seperti: /nota NamaToko 🏪"
      );
    }
    return;
  }

  // Jika pengguna sedang dalam stage menunggu input penerima
  if (
    notaData[message.from] &&
    notaData[message.from].stage === "waiting_for_receiver"
  ) {
    let receiver = message.body.trim();
    if (receiver.length === 0) {
      sendDelayed(
        message.from,
        "Nama penerima tidak boleh kosong. Silakan masukkan nama penerima pembelian."
      );
      return;
    }
    notaData[message.from].receiver = receiver;
    notaData[message.from].stage = "waiting_for_items";
    sendDelayed(
      message.from,
      `Penerima telah diatur sebagai "${receiver}".\nSekarang, silakan kirimkan daftar item (Nama, Harga, Jumlah) dalam format:\nNama Item, Harga, Jumlah`
    );
    return;
  }

  // Jika pesan mengandung tanda koma, anggap sebagai daftar item
  if (message.body.includes(",")) {
    if (!notaData[message.from]) {
      sendDelayed(
        message.from,
        "Silakan masukkan nama toko terlebih dahulu dengan perintah /nota NamaToko 🏪"
      );
      return;
    }
    if (notaData[message.from].stage !== "waiting_for_items") {
      sendDelayed(
        message.from,
        "Silakan masukkan nama penerima terlebih dahulu sebelum mengirimkan daftar item."
      );
      return;
    }

    const items = parseItems(message.body);
    if (items) {
      const { storeName, receiver } = notaData[message.from];
      let notaText = `=== NOTA PEMBELIAN ===\nToko: ${storeName}\nPenerima: ${receiver}\nTanggal: ${new Date().toLocaleString()}\n\n`;
      items.forEach((item) => {
        const itemTotal = item.price * item.quantity;
        notaText += `${item.name} (x${item.quantity}) - Rp ${itemTotal} 💰\n`;
      });
      const totalAmount = items.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0
      );
      notaText += `\nTotal: Rp ${totalAmount} 💸`;
      notaText += "\n=====================\nTerima kasih atas pembelian Anda! 🙏";

      sendDelayed(message.from, notaText);
      delete notaData[message.from];
    } else {
      sendDelayed(
        message.from,
        "Format input item salah. Harap kirimkan dalam format: Nama Item, Harga, Jumlah ❌"
      );
    }
    return;
  }

  // Pesan default dengan instruksi ketik /bantuan
  sendDelayed(
    message.from,
    "Maaf, saya tidak mengerti pesan Anda. 😕\nKetik /bantuan untuk cara penggunaan."
  );
});

// Fungsi untuk mem-parsing input item
function parseItems(input) {
  const items = input
    .split("\n")
    .map((line) => {
      const parts = line.split(",");
      if (parts.length === 3) {
        const name = parts[0].trim();
        const price = parseFloat(parts[1].trim());
        const quantity = parseInt(parts[2].trim(), 10);
        if (name && !isNaN(price) && !isNaN(quantity)) {
          return { name, price, quantity };
        }
      }
      return null;
    })
    .filter((item) => item !== null);

  return items.length > 0 ? items : null;
}

client.initialize();
