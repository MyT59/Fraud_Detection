def parse_device(user_agent: str):
    ua = (user_agent or "").lower()

    # device
    if "iphone" in ua:
        device = "iPhone"
    elif "android" in ua:
        device = "Android"
    elif "windows" in ua:
        device = "Windows"
    elif "mac" in ua:
        device = "Mac"
    else:
        device = "Unknown"

    # browser
    if "chrome" in ua and "edg" not in ua:
        browser = "Chrome"
    elif "safari" in ua and "chrome" not in ua:
        browser = "Safari"
    elif "firefox" in ua:
        browser = "Firefox"
    elif "edg" in ua:
        browser = "Edge"
    else:
        browser = "Unknown"

    return device, browser