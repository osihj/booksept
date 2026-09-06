#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Notion Journal 匯出檔 (Markdown & CSV) 轉日記 JSON 轉換工具
"""

import csv
import glob
import json
import os
import re
import sys
import argparse
from datetime import datetime

# ---------------- CONFIG ----------------
USE_FIRST_TAG_AS_CATEGORY = True   # True: 分類 = 第一個 Tag；False: 固定填「未分類」
DEFAULT_CATEGORY = "未分類"
# ----------------------------------------

DATE_FORMATS = [
    "%Y-%m-%d", "%Y/%m/%d",
    "%B %d, %Y", "%b %d, %Y",
    "%Y年%m月%d日",
    "%Y-%m-%d %H:%M", "%Y/%m/%d %H:%M",
]

def parse_notion_date(raw):
    raw = (raw or "").strip()
    if not raw:
        return None
    raw = raw.split("→")[0].strip()
    for fmt in DATE_FORMATS:
        try:
            return datetime.strptime(raw, fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    m = re.search(r"(\d{4})[年/-](\d{1,2})[月/-](\d{1,2})", raw)
    if m:
        y, mo, d = m.groups()
        return f"{int(y):04d}-{int(mo):02d}-{int(d):02d}"
    return None

def split_tags(raw):
    raw = (raw or "").strip()
    if not raw:
        return []
    return [t.strip() for t in raw.split(",") if t.strip()]

def md_body_to_html(md_text, title):
    lines = md_text.splitlines()
    clean_title = title.strip().lstrip("#").strip()
    
    # 移除開頭與標題相同的 H1 標題（如 `# #新的起點` 或 `# 新的起點`）
    if lines:
        first_line = lines[0].strip().lstrip("#").strip()
        if first_line == clean_title or first_line == title.strip():
            lines = lines[1:]

    # 過濾頂部屬性列（相容 Tags:, Date:, 狀態: 等中英文欄位）
    body_lines = []
    in_properties = True
    for line in lines:
        s_line = line.strip()
        if not s_line:
            continue
        # 匹配屬性列特徵（例如 Tags: Daily、Date: April 26, 2024、狀態: 未開始）
        if in_properties and re.match(r"^(Tags|Date|狀態|Category|Tag|日期|名稱|Name|Status)\s*[:：]", s_line, re.IGNORECASE):
            continue
        # 遇到第一個非屬性列文字即視為正文開始
        in_properties = False
        body_lines.append(line)

    body_text = "\n".join(body_lines).strip()
    if not body_text:
        return ""

    # 依空行切分段落轉 <p>，單一換行轉 <br>
    paragraphs = re.split(r"\n\s*\n", body_text)
    html_parts = []
    for p in paragraphs:
        p = p.strip()
        if not p:
            continue
        p_html = p.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        p_html = p_html.replace("\n", "<br>")
        html_parts.append(f"<p>{p_html}</p>")
    return "".join(html_parts)

def build_md_map(md_dir):
    """建立 .md 檔案地圖，忽略 Notion 自動產生的 32 位亂碼 ID 與標點符號差異"""
    md_map = {}
    all_mds = glob.glob(os.path.join(md_dir, "**/*.md"), recursive=True)
    for path in all_mds:
        filename = os.path.basename(path)
        m = re.match(r"^(.*?)(?:\s+[a-f0-9]{32})?\.md$", filename, re.IGNORECASE)
        if m:
            clean_title = m.group(1).strip()
            md_map[clean_title] = path
            simplified = re.sub(r"[^\w\u4e00-\u9fa5]", "", clean_title)
            if simplified:
                md_map[f"simp_{simplified}"] = path
    return md_map

def find_md_file(md_map, title):
    title_clean = title.strip()
    if title_clean in md_map:
        return md_map[title_clean]
    simplified = re.sub(r"[^\w\u4e00-\u9fa5]", "", title_clean)
    if f"simp_{simplified}" in md_map:
        return md_map[f"simp_{simplified}"]
    return None

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("export_dir", help="Notion 匯出後解壓縮出來的資料夾路徑")
    ap.add_argument("-o", "--output", default="diary_import.json")
    args = ap.parse_args()

    csv_files = glob.glob(os.path.join(args.export_dir, "*.csv"))
    if not csv_files:
        print("❌ 在指定資料夾裡找不到 .csv 檔，請確認路徑是否正確。")
        sys.exit(1)
    csv_path = csv_files[0]

    md_map = build_md_map(args.export_dir)

    entries = []
    skipped = []
    no_content_count = 0

    with open(csv_path, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            title = (row.get("Name") or row.get("名稱") or "").strip()
            if not title:
                continue
            date = parse_notion_date(row.get("Date") or row.get("日期") or "")
            tags = split_tags(row.get("Tags") or row.get("標籤") or "")
            category = (tags[0] if (USE_FIRST_TAG_AS_CATEGORY and tags) else DEFAULT_CATEGORY)

            md_path = find_md_file(md_map, title)
            content_html = ""
            if md_path and os.path.isfile(md_path):
                with open(md_path, encoding="utf-8") as mf:
                    content_html = md_body_to_html(mf.read(), title)
            
            if not content_html:
                no_content_count += 1
                skipped.append(f"《{title}》找不到內文或擷取失敗")

            if not date:
                skipped.append(f"《{title}》日期解析失敗")
                date = ""

            entries.append({
                "title": title,
                "date": date,
                "category": category,
                "tags": tags,
                "content": content_html,
            })

    with open(args.output, "w", encoding="utf-8") as out:
        json.dump(entries, out, ensure_ascii=False, indent=2)

    print(f"\n✅ 轉檔完成！共處理 {len(entries)} 篇，其中 {len(entries) - no_content_count} 篇成功擷取出內文。")
    print(f"📄 輸出檔案：{args.output}")
    if skipped:
        print("\n⚠️ 以下為需檢查的項目（前 10 筆）：")
        for s in skipped[:10]:
            print("   -", s)

if __name__ == "__main__":
    main()