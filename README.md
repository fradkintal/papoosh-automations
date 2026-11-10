# PAPOOSH • פפוש אוטומציות (`papoosh-automations`)

מרכז שליטה ובקרה (Command Center) אישי לאוטומציות, כספים, מיילים וכלים עסקיים עבור **טל פרדקין (פפוש)**.
המערכת בנויה כך שכל אוטומציה שרצה על המחשב הנייח (שדלוק 24/7) מדווחת בזמן אמת לממשק צבעוני, ברור וחד שמותאם במיוחד לשימוש מהאייפון – גם **כאפליקציית Web מאורחת (PWA)** וגם **כקובץ אפליקציה עצמאי (`PAPOOSH-iPhone-App.html`)** שניתן להוריד ולפתוח ישירות באייפון ללא צורך בשרת.

---

## מבנה הפרויקט (`C:\Users\fradk\PROGRAMS\papoosh-automations`)

* **`agent/papoosh-sdk.js`** – ספריית ליבה (SDK) לדיווח סטטוס ריצות, התראות, תקלות ומדדי מחשב לקובץ הטלמטריה החי (`public/data/telemetry.json`) ולענן (GitHub Pages / Firebase).
* **`agent/papoosh-cli.js`** – כלי שורת פקודה (CLI) שמאפשר לכל סקריפט במחשב (Node.js, Python, PowerShell, Batch) לדווח על ריצת אוטומציה בפקודה אחת.
* **`agent/run-automations.js`** – מנוע בדיקת המערכות והאוטומציות המובנה (כספים `finance-aggregator`, מיילים `Gmail`, יומן `Google Calendar`, מערכות `el-sol-sys` ו-`the-team-sys`, וסנכרון מאגרי `Git`).
* **`scripts/bump-version.js`** – מנגנון ניהול גרסאות אוטומטי (Semantic Versioning + Build Counter) שמעדכן את `public/version.json` ו-`src/version.js` בכל בנייה, כדי להבטיח שכל מי שצופה באפליקציה רואה תמיד את הגרסה העדכנית ביותר (Cache-Busting).
* **`scripts/build-standalone-iphone.js`** – אורז את האפליקציה המלאה, הלוגו של PAPOOSH והנתונים לקובץ יחיד להורדה ישירה לאייפון (`dist/PAPOOSH-iPhone-App.html`) ויוצר פרופיל התקנת אייקון למסך הבית באייפון (`dist/PAPOOSH-iPhone.mobileconfig`).
* **`src/App.jsx` & `src/styles.css`** – ממשק המשתמש הצבעוני של PAPOOSH בעיצוב ניאון כהה וברור לעין (ירוק = תקין, צהוב = התראה, אדום = תקלה, כחול/סגול = קטגוריות).

---

## איך מדווחים לפפוש מכל אוטומציה במחשב?

### 1. דרך שורת הפקודה (מתאים לכל שפה – Python / PowerShell / Batch / Node)
```powershell
node C:\Users\fradk\PROGRAMS\papoosh-automations\agent\papoosh-cli.js report `
  --id "finance-aggregator-sync" `
  --name "סנכרון כספים ובנקים" `
  --category "finance" `
  --status "success" `
  --summary "נמשכו 38 תנועות חדשות מכל החשבונות" `
  --push
```
*(הדגל `--push` מעלה אוטומטית את העדכון ל-GitHub כך שהאייפון יראה אותו מיד מכל מקום בעולם).*

### 2. מתוך קוד Node.js ישירות
```javascript
import { PapooshReporter } from '../papoosh-automations/agent/papoosh-sdk.js';

await PapooshReporter.reportRun({
  automationId: 'gmail-smart-invoices',
  name: 'סורק חשבוניות Gmail',
  category: 'email',
  status: 'success', // 'success' | 'warning' | 'error'
  summary: 'נסרקו 24 מיילים, נשמרו 3 חשבוניות חדשות',
  durationMs: 1850,
  syncToGit: true
});
```

---

## ניהול גרסאות ופרסום עדכונים (Versioning & Deployment)

הפרויקט כולל מנגנון **Cache-Busting** אוטומטי שבודק את `version.json?t=<timestamp>` בכל פתיחה של האפליקציה באייפון ומתריע מיד אם עלתה גרסה חדשה.

* **הרצת כל בדיקות האוטומציה המקומיות:**
  ```powershell
  npm run run-all
  ```
* **בניית גרסה חדשה + עדכון מספר Build + יצירת קובץ האייפון:**
  ```powershell
  npm run build
  ```
* **שחרור גרסת Patch חדשה (`1.0.x`):**
  ```powershell
  npm run release
  ```

---

## שימוש באייפון (2 אפשרויות לבחירתך)

1. **קובץ עצמאי להורדה ישירה (ללא צורך ב-Host):**
   הורד את הקובץ `PAPOOSH-iPhone-App.html` (בלחיצה על כפתור **"הורד לאייפון"** בראש האפליקציה או מתיקיית `dist/`) ושמור אותו באפליקציית **קבצים (Files)** באייפון. הקובץ פועל עצמאית לגמרי, וכשיש אינטרנט הוא גם מושך אוטומטית את הנתונים החיים מהמחשב הנייח!
2. **אפליקציית Web מאורחת (PWA עם אייקון במסך הבית):**
   פתח את הקישור המאורח ב-Safari באייפון (`https://fradkintal.github.io/papoosh-automations/`) ולחץ על **שיתוף ⬅ הוסף למסך הבית (Add to Home Screen)** או התקן את `PAPOOSH-iPhone.mobileconfig` כדי לקבל אייקון PAPOOSH צבעוני במסך הבית.
