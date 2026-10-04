# Changelog

Versions follow the API. Older history is in git.

## 1.0.0

Resource routes are published under `/v1`. `/health` and `/docs` stay unversioned so probes and the spec do not move when the API does.

Sign-in sets an HttpOnly `dam_token` cookie. The token is not returned to page scripts. Other sites cannot attach the cookie (`SameSite=Strict`). A non-browser client may still send `Authorization: Bearer`.

Postgres rejects oversized emails, password hashes, filenames, MIME types, storage keys, failure reasons, rendition labels, and tags. The API answers those with a generic `400`.

Only an admin can create a team or add and remove its members. My gallery lists uploads and can add a file to a team directly. Team gallery lists files granted to a team you belong to. An asset owner can also create a share link. The link token is shown once and stored as a hash. It expires within 30 days and can be revoked. Preview is public. Download counts only when the link allows it. Team members see those assets in the gallery. Everyone else still gets `404`.
