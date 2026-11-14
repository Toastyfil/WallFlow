use std::time::Duration;

use reqwest::blocking::Client;
use serde::Serialize;
use serde_json::Value;

use crate::store::{CustomSource, Wallpaper};

pub const BUILT_IN: [&str; 6] = [
    "wallhaven",
    "commons",
    "bing",
    "konachan",
    "safebooru",
    "deviantart",
];

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceError {
    pub source: String,
    pub message: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchResult {
    pub items: Vec<Wallpaper>,
    pub page: u32,
    pub has_more: bool,
    pub errors: Vec<SourceError>,
}

pub fn min_height(min_resolution: &str) -> u32 {
    match min_resolution {
        "1080p" => 1080,
        "1440p" => 1440,
        "4k" => 2160,
        _ => 0,
    }
}

pub fn orientation_ok(width: u32, height: u32, orientation: &str) -> bool {
    match orientation {
        "landscape" => width >= height,
        "portrait" => height >= width,
        "square" => {
            let (w, h) = (width.max(1) as f32, height.max(1) as f32);
            (w - h).abs() / w.max(h) < 0.08
        }
        _ => true,
    }
}

fn client() -> Client {
    Client::builder()
        .timeout(Duration::from_secs(12))
        .user_agent("WallFlow/1.1.3 (desktop wallpaper app)")
        .build()
        .expect("http client")
}

/// One catalog, one page. Errors are strings so the UI can report per-source failures.
pub fn search_one(
    source: &str,
    query: &str,
    page: u32,
    orientation: &str,
    min_res: &str,
    custom: Option<&CustomSource>,
) -> Result<(Vec<Wallpaper>, bool), String> {
    let client = client();
    let min = min_height(min_res);

    let (items, has_more) = match source {
        "wallhaven" => wallhaven(&client, query, page)?,
        "commons" => commons(&client, query)?,
        "bing" => bing(&client)?,
        "konachan" => konachan(&client, query, page)?,
        "safebooru" => safebooru(&client, query, page)?,
        "deviantart" => deviantart(&client, query, page)?,
        "openverse" => openverse(&client, query)?,
        "custom" => match custom {
            Some(source) => custom_source(&client, source)?,
            None => (Vec::new(), false),
        },
        other => return Err(format!("unknown source {other}")),
    };

    let filtered: Vec<Wallpaper> = items
        .into_iter()
        .filter(|item| item.width == 0 || item.height == 0 || item.height >= min)
        .filter(|item| orientation_ok(item.width, item.height, orientation))
        .take(24)
        .collect();

    Ok((filtered, has_more))
}

fn wallpaper(
    source: &str,
    id: String,
    title: String,
    author: String,
    page_url: String,
    thumb: String,
    preview: String,
    full: String,
    width: u32,
    height: u32,
) -> Wallpaper {
    Wallpaper {
        id: format!("{source}:{id}"),
        source: source.to_string(),
        source_label: None,
        kind: "image".into(),
        title,
        author: Some(author),
        page_url: Some(page_url),
        thumb_url: thumb,
        preview_url: preview,
        full_url: full,
        video_url: None,
        width,
        height,
        color: None,
        created_at: None,
    }
}

fn wallhaven(client: &Client, query: &str, page: u32) -> Result<(Vec<Wallpaper>, bool), String> {
    let mut request = client.get("https://wallhaven.cc/api/v1/search").query(&[
        ("purity", "100".to_string()),
        ("categories", "111".to_string()),
        ("page", page.to_string()),
    ]);
    if !query.trim().is_empty() {
        request = request.query(&[("q", query.trim().to_string())]);
    }

    let body: Value = request.send().map_err(err)?.json().map_err(err)?;
    let rows = body["data"].as_array().cloned().unwrap_or_default();

    let items = rows
        .iter()
        .filter_map(|row| {
            let full = row["path"].as_str()?.to_string();
            let resolution = row["resolution"].as_str().unwrap_or("0x0");
            let (width, height) = parse_resolution(resolution);
            let id = row["id"].as_str()?.to_string();
            Some(wallpaper(
                "wallhaven",
                id.clone(),
                format!("Wallhaven {id}"),
                "Wallhaven community".into(),
                row["url"].as_str().unwrap_or_default().to_string(),
                row["thumbs"]["large"]
                    .as_str()
                    .unwrap_or(&full)
                    .to_string(),
                row["thumbs"]["original"]
                    .as_str()
                    .unwrap_or(&full)
                    .to_string(),
                full,
                width,
                height,
            ))
        })
        .collect::<Vec<_>>();

    Ok((items, rows.len() >= 24))
}

fn commons(client: &Client, query: &str) -> Result<(Vec<Wallpaper>, bool), String> {
    let search = if query.trim().is_empty() {
        "filetype:bitmap wallpaper".to_string()
    } else {
        format!("filetype:bitmap {}", query.trim())
    };

    let body: Value = client
        .get("https://commons.wikimedia.org/w/api.php")
        .query(&[
            ("action", "query"),
            ("generator", "search"),
            ("gsrsearch", search.as_str()),
            ("gsrnamespace", "6"),
            ("gsrlimit", "40"),
            ("prop", "imageinfo"),
            ("iiprop", "url|size"),
            ("iiurlwidth", "640"),
            ("format", "json"),
        ])
        .send()
        .map_err(err)?
        .json()
        .map_err(err)?;

    let mut items = Vec::new();
    if let Some(pages) = body["query"]["pages"].as_object() {
        for page in pages.values() {
            let Some(info) = page["imageinfo"].as_array().and_then(|list| list.first()) else {
                continue;
            };
            let Some(url) = info["url"].as_str() else {
                continue;
            };
            let width = info["width"].as_u64().unwrap_or(0) as u32;
            let height = info["height"].as_u64().unwrap_or(0) as u32;
            if width < 1600 {
                continue;
            }
            let title = page["title"]
                .as_str()
                .unwrap_or("Wikimedia")
                .trim_start_matches("File:")
                .to_string();
            let thumb = info["thumburl"].as_str().unwrap_or(url).to_string();
            items.push(wallpaper(
                "commons",
                page["pageid"].as_u64().unwrap_or(0).to_string(),
                title,
                "Wikimedia Commons".into(),
                info["descriptionurl"].as_str().unwrap_or_default().to_string(),
                thumb.clone(),
                thumb,
                url.to_string(),
                width,
                height,
            ));
        }
    }

    Ok((items, false))
}

fn bing(client: &Client) -> Result<(Vec<Wallpaper>, bool), String> {
    let body: Value = client
        .get("https://www.bing.com/HPImageArchive.aspx")
        .query(&[
            ("format", "js"),
            ("idx", "0"),
            ("n", "8"),
            ("mkt", "en-US"),
        ])
        .send()
        .map_err(err)?
        .json()
        .map_err(err)?;

    let items = body["images"]
        .as_array()
        .map(|rows| {
            rows.iter()
                .filter_map(|row| {
                    let base = row["urlbase"].as_str()?;
                    let full = format!("https://www.bing.com{base}_UHD.jpg");
                    Some(wallpaper(
                        "bing",
                        row["startdate"].as_str().unwrap_or(base).to_string(),
                        row["title"].as_str().unwrap_or("Bing daily").to_string(),
                        row["copyright"].as_str().unwrap_or("Bing").to_string(),
                        format!("https://www.bing.com{base}"),
                        format!("https://www.bing.com{base}_400x240.jpg"),
                        full.clone(),
                        full,
                        3840,
                        2160,
                    ))
                })
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();

    Ok((items, false))
}

fn konachan(client: &Client, query: &str, page: u32) -> Result<(Vec<Wallpaper>, bool), String> {
    let tags = if query.trim().is_empty() {
        "rating:safe".to_string()
    } else {
        format!("{} rating:safe", query.trim().replace(' ', "_"))
    };

    let page_value = page.to_string();
    let body: Value = client
        .get("https://konachan.net/post.json")
        .query(&[
            ("tags", tags.as_str()),
            ("limit", "40"),
            ("page", page_value.as_str()),
        ])
        .send()
        .map_err(err)?
        .json()
        .map_err(err)?;

    let rows = body.as_array().cloned().unwrap_or_default();
    let items = rows
        .iter()
        .filter_map(|row| {
            let full = row["file_url"].as_str()?.to_string();
            let width = row["width"].as_u64().unwrap_or(0) as u32;
            if width < 1600 {
                return None;
            }
            let id = row["id"].as_u64().unwrap_or(0);
            Some(wallpaper(
                "konachan",
                id.to_string(),
                title_from_tags(row["tags"].as_str().unwrap_or(""), "Konachan wallpaper"),
                row["author"].as_str().unwrap_or("Konachan").to_string(),
                format!("https://konachan.net/post/show/{id}"),
                row["preview_url"].as_str().unwrap_or_default().to_string(),
                row["sample_url"].as_str().unwrap_or(&full).to_string(),
                full,
                width,
                row["height"].as_u64().unwrap_or(0) as u32,
            ))
        })
        .collect::<Vec<_>>();

    Ok((items, rows.len() >= 40))
}

fn safebooru(client: &Client, query: &str, page: u32) -> Result<(Vec<Wallpaper>, bool), String> {
    let tags = if query.trim().is_empty() {
        "wallpaper".to_string()
    } else {
        query.trim().to_lowercase().replace(' ', "_")
    };

    let body: Value = client
        .get("https://safebooru.org/index.php")
        .query(&[
            ("page", "dapi".to_string()),
            ("s", "post".to_string()),
            ("q", "index".to_string()),
            ("json", "1".to_string()),
            ("limit", "100".to_string()),
            ("pid", (page.saturating_sub(1)).to_string()),
            ("tags", tags),
        ])
        .send()
        .map_err(err)?
        .json()
        .map_err(err)?;

    let rows = body.as_array().cloned().unwrap_or_default();
    let items = rows
        .iter()
        .filter_map(|row| {
            let full = row["file_url"]
                .as_str()
                .or_else(|| row["sample_url"].as_str())?
                .to_string();
            let width = row["width"].as_u64().unwrap_or(0) as u32;
            if width < 1600 {
                return None;
            }
            let id = row["id"].as_u64().unwrap_or(0);
            Some(wallpaper(
                "safebooru",
                id.to_string(),
                title_from_tags(row["tags"].as_str().unwrap_or(""), "Safebooru wallpaper"),
                row["owner"].as_str().unwrap_or("Safebooru").to_string(),
                format!("https://safebooru.org/index.php?page=post&s=view&id={id}"),
                row["preview_url"].as_str().unwrap_or_default().to_string(),
                row["sample_url"].as_str().unwrap_or(&full).to_string(),
                full,
                width,
                row["height"].as_u64().unwrap_or(0) as u32,
            ))
        })
        .collect::<Vec<_>>();

    Ok((items, rows.len() >= 100))
}

fn deviantart(client: &Client, query: &str, page: u32) -> Result<(Vec<Wallpaper>, bool), String> {
    let search = if query.trim().is_empty() {
        "wallpaper".to_string()
    } else {
        format!("{} wallpaper", query.trim())
    };

    let offset = ((page - 1) * 24).to_string();
    let response = client
        .get("https://backend.deviantart.com/rss.xml")
        .query(&[
            ("q", search.as_str()),
            ("type", "deviation"),
            ("offset", offset.as_str()),
        ])
        .header("Accept", "application/rss+xml, application/xml;q=0.9, */*;q=0.8")
        .header(
            "User-Agent",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        )
        .send()
        .map_err(err)?;

    let status = response.status();
    let xml = response.text().map_err(err)?;
    if !status.is_success() {
        return Err(format!("DeviantArt responded {status}"));
    }


    let item_re = regex::Regex::new(r"(?is)<item>(.*?)</item>").unwrap();
    let content_re = regex::Regex::new(r#"(?is)<media:content\b([^>]*)>"#).unwrap();
    let url_re = regex::Regex::new(r#"(?is)url="([^"]+)""#).unwrap();
    let width_re = regex::Regex::new(r#"(?is)width="(\d+)""#).unwrap();
    let height_re = regex::Regex::new(r#"(?is)height="(\d+)""#).unwrap();
    let title_re = regex::Regex::new(r"(?is)<title>(.*?)</title>").unwrap();
    let credit_re = regex::Regex::new(r"(?is)<media:credit[^>]*>(.*?)</media:credit>").unwrap();
    let link_re = regex::Regex::new(r"(?is)<link>(.*?)</link>").unwrap();
    let adult_re = regex::Regex::new(r"(?is)<media:rating>\s*adult\s*<").unwrap();

    let mut items = Vec::new();
    let blocks: Vec<_> = item_re.captures_iter(&xml).collect();
    for block in &blocks {
        let fragment = &block[1];
        if adult_re.is_match(fragment) {
            continue;
        }
        let Some(content) = content_re.captures(fragment) else {
            continue;
        };
        let attrs = &content[1];
        let Some(url) = url_re.captures(attrs).map(|m| m[1].to_string()) else {
            continue;
        };
        let width = width_re
            .captures(attrs)
            .and_then(|m| m[1].parse::<u32>().ok())
            .unwrap_or(0);
        let height = height_re
            .captures(attrs)
            .and_then(|m| m[1].parse::<u32>().ok())
            .unwrap_or(0);
        if width > 0 && width < 1000 {
            continue;
        }
        let title = title_re
            .captures(fragment)
            .map(|m| clean_xml(&m[1]))
            .unwrap_or_else(|| "DeviantArt wallpaper".into());
        let author = credit_re
            .captures(fragment)
            .map(|m| clean_xml(&m[1]))
            .unwrap_or_else(|| "DeviantArt artist".into());
        let page_url = link_re
            .captures(fragment)
            .map(|m| clean_xml(&m[1]))
            .unwrap_or_default();

        items.push(wallpaper(
            "deviantart",
            url.clone(),
            title,
            author,
            page_url,
            url.clone(),
            url.clone(),
            url,
            width,
            height,
        ));
    }

    Ok((items, blocks.len() >= 24))
}

fn openverse(client: &Client, query: &str) -> Result<(Vec<Wallpaper>, bool), String> {
    let body: Value = client
        .get("https://api.openverse.org/v1/images/")
        .query(&[
            ("q", query.trim()),
            ("page_size", "20"),
            ("mature", "false"),
            ("size", "large"),
        ])
        .send()
        .map_err(err)?
        .json()
        .map_err(err)?;

    let items = body["results"]
        .as_array()
        .map(|rows| {
            rows.iter()
                .filter_map(|row| {
                    let full = row["url"].as_str()?;
                    let width = row["width"].as_u64().unwrap_or(0) as u32;
                    let height = row["height"].as_u64().unwrap_or(0) as u32;
                    Some(wallpaper(
                        "openverse",
                        row["id"].as_str()?.to_string(),
                        row["title"].as_str().unwrap_or("Openverse image").to_string(),
                        row["creator"].as_str().unwrap_or("Openverse").to_string(),
                        row["foreign_landing_url"].as_str().unwrap_or_default().to_string(),
                        row["thumbnail"].as_str().unwrap_or(full).to_string(),
                        row["thumbnail"].as_str().unwrap_or(full).to_string(),
                        full.to_string(),
                        width,
                        height,
                    ))
                })
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();

    Ok((items, false))
}

fn custom_source(client: &Client, source: &CustomSource) -> Result<(Vec<Wallpaper>, bool), String> {
    let lower = source.url.to_lowercase();
    let is_video = [".mp4", ".webm", ".mov"]
        .iter()
        .any(|ext| lower.ends_with(ext));

    if source.kind == "direct" || is_video {
        let item = Wallpaper {
            id: format!("custom:{}", source.id),
            source: "custom".into(),
            source_label: Some(source.name.clone()),
            kind: if is_video { "video".into() } else { "image".into() },
            title: source.name.clone(),
            author: Some("Your feed".into()),
            page_url: Some(source.url.clone()),
            thumb_url: source.url.clone(),
            preview_url: source.url.clone(),
            full_url: source.url.clone(),
            video_url: if is_video {
                Some(source.url.clone())
            } else {
                None
            },
            width: 0,
            height: 0,
            color: None,
            created_at: None,
        };
        return Ok((vec![item], false));
    }

    let xml = client.get(&source.url).send().map_err(err)?.text().map_err(err)?;
    let item_re = regex::Regex::new(r"(?is)<item>(.*?)</item>").unwrap();
    let title_re = regex::Regex::new(r"(?is)<title>(.*?)</title>").unwrap();
    let link_re = regex::Regex::new(r"(?is)<link>(.*?)</link>").unwrap();
    let media_re = regex::Regex::new(r#"(?is)<media:content[^>]*url="([^"]+)""#).unwrap();
    let enclosure_re = regex::Regex::new(r#"(?is)<enclosure[^>]*url="([^"]+)""#).unwrap();
    let img_re = regex::Regex::new(r#"(?is)<img[^>]*src="([^"]+)""#).unwrap();

    let mut items = Vec::new();
    for (index, block) in item_re.captures_iter(&xml).enumerate() {
        let fragment = &block[1];
        let image = media_re
            .captures(fragment)
            .or_else(|| enclosure_re.captures(fragment))
            .or_else(|| img_re.captures(fragment))
            .map(|m| m[1].to_string());
        let Some(image) = image else { continue };

        let title = title_re
            .captures(fragment)
            .map(|m| clean_xml(&m[1]))
            .unwrap_or_else(|| source.name.clone());
        let page = link_re
            .captures(fragment)
            .map(|m| clean_xml(&m[1]))
            .unwrap_or_default();

        items.push(Wallpaper {
            id: format!("custom:{}:{index}", source.id),
            source: "custom".into(),
            source_label: Some(source.name.clone()),
            kind: "image".into(),
            title,
            author: Some(source.name.clone()),
            page_url: Some(page),
            thumb_url: image.clone(),
            preview_url: image.clone(),
            full_url: image,
            video_url: None,
            width: 0,
            height: 0,
            color: None,
            created_at: None,
        });
        if items.len() >= 24 {
            break;
        }
    }

    Ok((items, false))
}

fn title_from_tags(tags: &str, fallback: &str) -> String {
    let words: Vec<String> = tags
        .split_whitespace()
        .filter(|tag| !tag.is_empty() && !tag.contains(':'))
        .filter(|tag| !matches!(*tag, "tagme" | "highres" | "absurdres" | "wallpaper"))
        .take(4)
        .map(|tag| tag.replace('_', " "))
        .collect();
    if words.is_empty() {
        fallback.to_string()
    } else {
        words.join(" · ")
    }
}

fn clean_xml(input: &str) -> String {
    input
        .replace("<![CDATA[", "")
        .replace("]]>", "")
        .replace("&amp;", "&")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

fn parse_resolution(value: &str) -> (u32, u32) {
    let mut parts = value.split('x');
    (
        parts.next().and_then(|v| v.parse().ok()).unwrap_or(0),
        parts.next().and_then(|v| v.parse().ok()).unwrap_or(0),
    )
}

fn err(error: reqwest::Error) -> String {
    if error.is_timeout() {
        "Source took too long".to_string()
    } else {
        error.to_string()
    }
}
