def get_mimetype(filename):
    mimetypes = {
        'jpg':'image/jpeg',
        'jpeg':'image/jpeg',
        'png':'image/png',
        'webp':'image/webp'
    }
    ext = filename.split('.')[1]
    return mimetypes[ext]