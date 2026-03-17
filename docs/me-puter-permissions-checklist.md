# me.puter Permission Yönetimi

## Admin endpointleri

- `POST /api/admin/users/:userId/permissions/me-puter/grant`
- `POST /api/admin/users/:userId/permissions/me-puter/revoke`
- `PATCH /api/admin/users/:userId/permissions`

Örnek `PATCH` body:

```json
{
  "permissions": {
    "use_chat": true,
    "use_image": true,
    "use_video": false,
    "use_photo_to_video": false,
    "use_tts": true,
    "use_music": false
  }
}
```

## "Permission denied." teşhis checklist

1. Status code ve `code` alanını doğrula (`NO_TOKEN`, `INVALID_TOKEN`, `USER_NOT_FOUND`, `ACCOUNT_INACTIVE`, `NOT_ADMIN`, `PERMISSION_DENIED`, `ASSET_FORBIDDEN`, `OWNER_RUNTIME_CALL_FAILED`).
2. Token varlığını doğrula (cookie veya `Authorization: Bearer`).
3. Token doğrulamasını kontrol et (expired/invalid).
4. `users:{id}` veya `userByEmail:{email}` çözümlemesini doğrula.
5. `aktif_mi` alanının `true` olduğunu doğrula.
6. Route middleware zincirini doğrula (`requireAuth`, `requireAdmin`, `requirePermission`).
7. `ENV_ROLE_ENFORCEMENT_MODE=backend_strict` durumunu kontrol et.
8. `ENV_REQUIRE_PERMISSION_CHECK_ON_ALL_AI_ACTIONS` bayrağını kontrol et.
9. `ENV_REQUIRE_PERMISSION_CHECK_ON_ADMIN_ACTIONS` bayrağını kontrol et.
10. `users:{id}.permissions` anahtarlarını doğrula:
   - `use_chat`
   - `use_image`
   - `use_video`
   - `use_photo_to_video`
   - `use_tts`
   - `use_music`
11. Kullanıcı rolünü doğrula (`rol === 'admin'` ise izinler otomatik genişler).
12. Endpoint-permission eşleşmesini doğrula (`/ai/chat`→`use_chat`, `/ai/image`→`use_image`, `/ai/video`→`use_video`, `/ai/tts`→`use_tts`, `/ai/music`→`use_music`, `/ai/photo-to-video`→`use_photo_to_video`).
13. Asset sahipliğini doğrula (`asset.kullanici_id === req.user.id`).
14. Dosya yolu üretiminde kullanıcı kimliğini doğrula (`/users/${userId}/...`).
15. Owner runtime ayarlarını doğrula (`PUTER_OWNER_AI_TOKEN`, `PUTER_OWNER_AI_BASE_URL`).
16. Fail → grant → success zincirini aynı kullanıcı ile tekrarla.
17. Loglarda ilk kırılma noktasını sınıflandır (auth/permission/asset/owner-runtime).
18. Kabul kriteri: doğru auth + doğru permission + ilgili route'ta 200 + beklenen JSON + bozulmamış admin akışları.
