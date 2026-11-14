# نشر MCTiers على سيرفر Minecraft (130.78.218.210)

الموقع يعمل بـ **Node.js فقط** — لا يوجد build ولا قواعد بيانات. كل التشغيل من ملف واحد.
نفس العملية تشغّل الموقع + الـ tier hub (واجهة الـ plugin) معاً على أي منفذ.

---

## 1. المتطلبات على السيرفر (Linux)

```bash
# Ubuntu / Debian
sudo apt update && sudo apt install -y nodejs
node --version   # أي إصدار 18+
```

لو ما عندك Node:
```bash
# أو ثبّته مباشرة بدونه PackageManager:
curl -fsSL https://nodejs.org/dist/v20.19.0/node-v20.19.0-linux-x64.tar.xz -o node.tar.xz
sudo tar -xJf node.tar.xz -C /opt
sudo ln -s /opt/node-v20.19.0-linux-x64/bin/node /usr/local/bin/node
```

---

## 2. رفع الموقع

### من ويندوز (WinSCP)
1. حمّل WinSCP: https://winscp.net/eng/download.php
2. اتصال SFTP أو SCP:
   - المضيف: `130.78.218.210`
   - Port: `22` (لو ما فيه نفاذ أرصاد/RCON، اسأل مستضيفك)
   - Username / Password: نفس ما تعطيك الاستضافة
3. انسخ **محتوى مجلد `Default Project` كاملاً** إلى `/home/mctiers/site/`
   - لو مجلد الموقع اسمه `site` عندك، أي اسم ما يفرق

### من ويندوز (Explorer + U盘)
- حط المجلد على USB وافتحه من نفس الجهاز لو عندك نفاذ فيزيائي.

### من Linux (SCP)
```bash
scp -r 151 ./Default\ Project user@130.78.218.210:/home/mctiers/site
```

---

## 3. تشغيل الموقع + الـ Hub

### تشغيل يدوي سريع (تجربة)
```bash
cd /home/mctiers/site
node tools/serve.mjs 8080
# ثم visit: http://130.78.218.210:8080
```

### تشغيل دائم عبر systemd (مستحسن)

أنشئ الملف:
```bash
sudo nano /etc/systemd/system/mctiers-site.service
```

المحتوى (غيّر المسارات وUl's لو لزم):
```ini
[Unit]
Description=MCTiers website and tier hub
After=network.target

[Service]
Type=simple
User=mctiers
Group=mctiers
WorkingDirectory=/home/mctiers/site
ExecStart=/usr/bin/node tools/serve.mjs 8080
Restart=always
RestartSec=5
Environment=TIERHUB_TOKEN=mctiers-local

[Install]
WantedBy=multi-user.target
```

ثم:
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now mctiers-site
sudo systemctl status mctiers-site
```

---

## 4. فتح المنفذ في الجدار الناري

```bash
sudo ufw allow 8080/tcp
# لو عندك SELinux: sudo setsebool -P httpd_can_network_connect 1
```
أو افتح 8080 من لوحة التحكم عند مستضيفك (pterodactyl / multicraft / panel) نفس ما تفتح 25606.

---

## 5. تثبيت الـ Plugin على سيرفر Minecraft

1. خذ الملف: `mctiers-tiertest-1.0.0.jar` (يوجد في جذر المشروع)
2. ← ضعه في مجلد `plugins/` في سيرفر الماينكرافت
3. أعد تشغيل السيرفر

الملف `plugins/MCTiersTierTest/config.yml` يتولد حينها تلقائياً:
```yaml
hub:
  url: "http://localhost:4173"        # الموقع على نفس الجهاز دائماً
  website: "http://130.78.218.210:8080/chat.html"  # منين الزائر يفتح اللينك
  token: "mctiers-local"
```
الـ `token` هناك وفي متغير بيئة `TIERHUB_TOKEN` للسيرفر يجب أن يتطابقان.

بعد إعادة التشغيل:
```
/tiertest
```
سيطب عليك رسالة بالكود — انقر عليه من داخل اللعبة → يفتح الموقع مع الكود معبأ تلقائياً.

---

## 6. متى تشتري الدومين `crakedmctiers.gg`

إذا اشتريته وربطته (A record) بـ `130.78.218.210`:

1. ينفع تخلي الموقع على منفذ 80/443، مثلاً:
   ```bash
   sudo node tools/serve.mjs 80
   sudo ufw allow 80/tcp
   ```
   أو عبر nginx:
   ```nginx
   server {
     listen 80;
     server_name crakedmctiers.gg;
     root /home/mctiers/site;
     index index.html;
     location /api/ { proxy_pass http://127.0.0.1:4173; }
     location / { try_files $uri $uri/ /index.html; }
   }
   ```
2. غيّر `hub.url` لو الموقع منفصل، و`website` — استعمل
   `https://crakedmctiers.gg/chat.html` , `hub.url` بـ `http://localhost:4173` (loopback) دائماً.
3. استبدلنا الأيقونة — ما يحتاج شيء ثانٍ.

---

## فحوصات سريعة

| ماذا | كيف |
|---|---|
| الموقع يعمل | `curl -I http://130.78.218.210:8080` يرجع `HTTP/1.1 200` |
| الـ hub يعمل | `curl http://130.78.218.210:8080/api/tiertest/state` يرجع JSON |
| الخدمة تشتغل | `systemctl status mctiers-site` |

## ملاحظة أمان
الموقع غير مصرّح لأي人 — أي شخص يصل للويب بإمكانه قراءة البيانات. أضف كلمة مرور لو الموقع فيه خطورة بيانات حساسة.
