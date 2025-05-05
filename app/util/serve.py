def get_mimetype(filename):
    mimetypes = {
        'jpg':'image/jpeg',
        'jpeg':'image/jpeg',
        'png':'image/png',
        'webp':'image/webp',
        'gif': 'image/gif',
        'ico':'image/vnd.microsoft.icon'
    }
    parts = filename.rsplit('.', 1)
    if len(parts) > 1:
        ext = parts[1].lower()
        return mimetypes.get(ext, 'application/octet-stream')
    else:
        return 'application/octet-stream'