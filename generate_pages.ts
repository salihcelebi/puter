import fs from 'fs';
import path from 'path';

const pages = [
  { path: 'src/pages/Login.tsx', name: 'Login' },
  { path: 'src/pages/Register.tsx', name: 'Register' },
  { path: 'src/pages/Dashboard.tsx', name: 'Dashboard' },
  { path: 'src/pages/Assets.tsx', name: 'Assets' },
  { path: 'src/pages/Billing.tsx', name: 'Billing' },
  { path: 'src/pages/Account.tsx', name: 'Account' },
  { path: 'src/pages/AI/Chat.tsx', name: 'Chat' },
  { path: 'src/pages/AI/image.tsx', name: 'Image' },
  { path: 'src/pages/AI/VideoGen.tsx', name: 'VideoGen' },
  { path: 'src/pages/AI/PhotoToVideo.tsx', name: 'PhotoToVideo' },
  { path: 'src/pages/AI/TTS.tsx', name: 'TTS' },
  { path: 'src/pages/Admin/AdminDashboard.tsx', name: 'AdminDashboard' },
  { path: 'src/pages/Admin/AdminUsers.tsx', name: 'AdminUsers' },
  { path: 'src/pages/Admin/AdminModels.tsx', name: 'AdminModels' },
  { path: 'src/pages/Admin/AdminLogs.tsx', name: 'AdminLogs' },
  { path: 'src/pages/Admin/AdminPayments.tsx', name: 'AdminPayments' }
];

const dirs = ['src/pages', 'src/pages/AI', 'src/pages/Admin'];
dirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

pages.forEach(page => {
  const content = `export default function ${page.name}() {
  return (
    <div className="p-6 bg-white rounded-xl border border-zinc-200 shadow-sm">
      <h1 className="text-2xl font-bold mb-4">${page.name}</h1>
      <p className="text-zinc-500">Bu sayfa yapım aşamasındadır.</p>
    </div>
  );
}
`;
  fs.writeFileSync(path.resolve(page.path), content);
});
console.log('Pages generated successfully.');
