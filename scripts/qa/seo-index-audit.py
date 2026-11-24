"""Check indexable storefront HTTP and verify HTML against the public catalog."""

import argparse
import json
import re
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import quote, urlencode, urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener
from urllib.error import HTTPError
from xml.etree import ElementTree


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


class Document(HTMLParser):
    def __init__(self, html):
        super().__init__()
        self.html_attributes = {}
        self.canonical = []
        self.metadata = {}
        self.schemas = []
        self.title = ""
        self.h1 = 0
        self.in_main = False
        self.main_text = []
        self.main_links = set()
        self.links = set()
        self.active = None
        self.feed(html)

    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        if tag == "html":
            self.html_attributes = values
        if tag == "link" and values.get("rel") == "canonical":
            self.canonical.append(values["href"])
        if tag == "meta":
            key = values.get("name") or values.get("property")
            if key:
                assert key not in self.metadata, key
                self.metadata[key] = values.get("content")
        if tag == "h1":
            self.h1 += 1
        if tag == "main":
            self.in_main = True
        if tag == "a" and values.get("href"):
            self.links.add(values["href"])
            if self.in_main:
                self.main_links.add(values["href"])
        if tag == "title" or (tag == "script" and values.get("type") == "application/ld+json"):
            self.active = tag

    def handle_endtag(self, tag):
        if self.active == tag:
            self.active = None
        if tag == "main":
            self.in_main = False

    def handle_data(self, value):
        if self.active == "title":
            self.title += value
        if self.active == "script":
            self.schemas.append(json.loads(value))
        if self.in_main and not self.active:
            self.main_text.append(value)


def schema_terms(value, terms):
    if isinstance(value, list):
        for item in value:
            schema_terms(item, terms)
    if isinstance(value, dict):
        for key, item in value.items():
            if not key.startswith("@"):
                assert "schema:" + key in terms, key
            if key == "@type":
                assert "schema:" + item in terms, item
            schema_terms(item, terms)
    if isinstance(value, str) and value.startswith("https://schema.org/"):
        term = value.removeprefix("https://schema.org/")
        assert "schema:" + term in terms, term


def check_geo(documents, products):
    representatives = {f"/products/{slug}-1-mesghal" for slug in ("poshal", "negin", "super-negin")}
    guides = {f"/guide/{slug}-saffron" for slug in ("check", "brew", "store")}
    home = documents["/"]
    about = documents["/about"]
    contact = documents["/contact"]
    organization = next(entity for entity in home.schemas if entity["@type"] == "Organization")
    assert organization["name"] == "زعفران ورسا" and "VARSA Saffron" in organization["alternateName"]
    assert organization["contactPoint"]["url"] == contact.canonical[0]
    assert "tel:" + organization["telephone"] in home.links & contact.main_links
    for document, page_type in [(about, "AboutPage"), (contact, "ContactPage")]:
        entity = next(entity for entity in document.schemas if entity["@type"] == page_type)
        assert entity["about"]["@id"] == organization["@id"]
    assert "تیم ورسا تأمین، بسته‌بندی و فروش" in "".join(about.main_text)
    assert any(link.startswith("https://trustseal.enamad.ir/") for link in about.main_links)
    assert "/account?view=orders" in contact.main_links
    assert "کد رهگیری پستی" in "".join(contact.main_text)
    assert representatives <= documents["/guide"].main_links
    for path in representatives:
        document = documents[path]
        product = products[path]
        markup = next(entity for entity in document.schemas if entity["@type"] == "Product")
        assert markup["description"] in "".join(document.main_text)
        assert markup["brand"]["name"] == organization["name"]
        assert markup["weight"]["value"] == product["weight"] and markup["weight"]["unitText"] == product["weight_unit"]
        assert markup["offers"]["seller"]["@id"] == organization["@id"]
        assert guides | (representatives - {path}) <= document.main_links
    for path in guides:
        document = documents[path]
        article = next(entity for entity in document.schemas if entity["@type"] == "Article")
        assert article["citation"] and set(article["citation"]) <= document.main_links
        assert document.main_links & representatives
    assert all(
        "شاخص‌های درج‌شده در کاتالوگ" not in "".join(documents[path].main_text)
        for path in products
    )
    return {"product_comparisons": len(representatives), "guides": len(guides), "brand_and_contact": True}


def run(origin, host, vocabulary, geo=False, live=False):
    opener = build_opener(NoRedirect)

    def request(path, method="GET", request_host=host):
        try:
            result = opener.open(Request(origin + path, method=method, headers={"Host": request_host}), timeout=12)
        except HTTPError as error:
            result = error
        with result:
            return result.status, result.headers, result.read()

    status, headers, xml = request("/sitemap.xml")
    assert status == 200 and headers.get_content_type() == "application/xml"
    namespace = {"s": "http://www.sitemaps.org/schemas/sitemap/0.9"}
    urls = [location.text for location in ElementTree.fromstring(xml).findall("s:url/s:loc", namespace)]
    assert urls and len(set(urls)) == len(urls)
    status, headers, body = request("/api/store/products")
    assert status == 200
    products = {"/products/" + quote(p["slug"], safe=""): p for p in json.loads(body)}
    unpublished_fields = {"crocin", "picrocrocin", "safranal"}
    if geo:
        assert all(unpublished_fields.isdisjoint(p) for p in products.values())
    assert all("https://" + host + path in urls for path in products)
    vocabulary_terms = {item["@id"] for item in json.loads(vocabulary.read_text(encoding="utf-8"))["@graph"]}
    titles, descriptions, types = set(), set(), set()
    documents = {}
    for url in urls:
        url_parts = urlsplit(url)
        assert url_parts.scheme == "https" and url_parts.netloc == host
        assert not url_parts.query and not url_parts.fragment
        path = url_parts.path
        status, headers, body = request(path)
        assert status == 200 and not headers.get("X-Robots-Tag"), path
        assert headers.get_content_type() == "text/html" and headers.get("Content-Security-Policy"), path
        html = body.decode()
        document = Document(html)
        documents[path] = document
        if geo:
            assert all(f'"{field}":' not in html for field in unpublished_fields), path
        assert document.html_attributes.get("lang") == "fa-IR" and document.html_attributes.get("dir") == "rtl"
        assert document.canonical == [url] and document.metadata["og:url"] == url
        assert document.metadata["robots"] == "index,follow"
        assert document.metadata["description"] and document.title and document.h1 == 1, path
        titles.add(document.title)
        descriptions.add(document.metadata["description"])
        for entity in document.schemas:
            schema_terms(entity, vocabulary_terms)
            types.add(entity["@type"])
        if path in products:
            product = products[path]
            entity = next(e for e in document.schemas if e["@type"] == "Product")
            assert entity["name"] == product["name"] and entity["sku"] == product["id"]
            assert entity["category"] == product["category"]
            if product["weight"] > 0 and product["weight_unit"] in ("گرم", "کیلوگرم", "مثقال", "g", "kg"):
                assert entity["weight"]["value"] == product["weight"], path
                assert entity["weight"]["unitText"] == product["weight_unit"], path
            assert entity["url"] == url and entity["offers"]["priceCurrency"] == "IRR"
            assert entity["offers"]["price"] == str(product["price"] * 10)
            assert product["name"] in html and "تومان" in html and 'id="product-title"' in html
            price = f"{product['price']:,}".translate(str.maketrans("0123456789", "۰۱۲۳۴۵۶۷۸۹"))
            assert price in re.search(r'<main\b.*?</main>', html, re.DOTALL)[0], path
            if product.get("stock") is not None:
                expected = "OutOfStock" if product["stock"] == 0 else "InStock"
                assert entity["offers"]["availability"] == "https://schema.org/" + expected
            else:
                assert "availability" not in entity["offers"]
    assert len(titles) == len(descriptions) == len(urls)
    assert {"Organization", "WebSite", "Article", "Product", "BreadcrumbList"}.issubset(types)

    status, headers, body = request("/robots.txt")
    assert status == 200 and headers.get_content_type() == "text/plain"
    assert f"Sitemap: https://{host}/sitemap.xml" in body.decode()
    assert "User-agent: GPTBot" in body.decode() and "User-agent: OAI-SearchBot" not in body.decode()
    if not live:
        assert request("/robots.txt", request_host="preview.example.test")[2].decode() == "User-agent: *\nDisallow: /\n"
        assert request("/sitemap.xml", request_host="preview.example.test")[0] == 404
        assert request("/shop", request_host="preview.example.test")[1]["X-Robots-Tag"] == "noindex,follow"
    assert request("/shop", "HEAD")[2] == b""
    status, headers, _ = request("/shop/?source=test")
    assert (status, headers["Location"]) == (308, "/shop?source=test")
    query = urlencode({"category": "نگین", "weight": "1", "unit": "گرم"})
    status, headers, _ = request("/shop?" + query)
    assert status == 308 and headers["Location"].startswith("/categories/negin?")
    assert request(headers["Location"])[1]["X-Robots-Tag"] == "noindex,follow"
    for path in ("/admin", "/account", "/payment/123"):
        status, headers, body = request(path)
        assert status == 200 and headers["X-Robots-Tag"] == "noindex,nofollow"
        assert headers["Cache-Control"] == "no-store" and b"application/ld+json" not in body
    for path in ("/unknown", "/products/missing", "/journal/missing", "/categories/missing"):
        assert request(path)[0] == 404
    report = {"sitemap": len(urls), "products": len(products), "structured_types": sorted(types)}
    if geo:
        report["geo"] = check_geo(documents, products)
    print(json.dumps(report))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--origin", default="http://127.0.0.1:5181")
    parser.add_argument("--host", default="varsasaffron.ir")
    parser.add_argument("--vocabulary", required=True, type=Path)
    parser.add_argument("--geo", action="store_true", help="Check confirmed Varsa content and three one-mesghal products")
    parser.add_argument("--live", action="store_true", help="Read the public Varsa HTTPS site")
    args = parser.parse_args()
    origin = args.origin.rstrip("/")
    if args.live:
        assert origin == "https://varsasaffron.ir" and args.host == "varsasaffron.ir", "Use the public Varsa HTTPS origin"
    else:
        assert urlsplit(origin).hostname in ("127.0.0.1", "localhost"), "Use loopback for a local audit"
    run(origin, args.host, args.vocabulary, args.geo, args.live)
