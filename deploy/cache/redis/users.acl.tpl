user default on #__REDIS_ADMIN_PASSWORD_SHA256__ ~* &* +@all
user ecommerce_app on #__REDIS_APP_PASSWORD_SHA256__ ~catalog:* resetchannels +@all -@dangerous
