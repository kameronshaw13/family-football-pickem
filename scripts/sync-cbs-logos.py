"""Refresh team logo mappings from the published ESPN and CBS directories."""

import json
import re
import time
import unicodedata
import urllib.request
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor
from html.parser import HTMLParser
from pathlib import Path

DIRECTORIES = {
    "nba": ("nba", "basketball/nba"),
    "nfl": ("nfl", "football/nfl"),
    "cbb": ("college-basketball", "basketball/mens-college-basketball"),
    "cfb": ("college-football", "football/college-football"),
}
CBS_ASSET = re.compile(r"https://sports.cbsimg.net/fly/images/team-logos/(\d+)\.svg")
ESPN_GUID = re.compile(r"/guid/([^/]+)/")

COLLEGE_ALIASES = {'44': 'American Eagles',
 '349': 'Army West Point Black Knights',
 '2463': 'Northridge Matadors',
 '2110': 'Cent. Arkansas Bears',
 '2115': 'Central Connecticut State Blue Devils',
 '232': 'College of Charleston Cougars',
 '48': "Delaware Fightin' Blue Hens",
 '2174': 'Detroit Titans',
 '2193': 'E. Tennessee State Buccaneers',
 '339': 'Evansville Aces',
 '161': 'FDU Knights',
 '2241': 'Gardner-Webb Bulldogs',
 '2755': 'Grambling St. Tigers',
 '2253': 'Grand Canyon Antelopes',
 '62': 'Hawaii Warriors',
 '85': 'IUI Jaguars',
 '2443': 'New Orleans Privateers',
 '112358': 'LIU Sharks',
 '2341': 'LIU Sharks',
 '193': 'Miami (Ohio) RedHawks',
 '2390': 'Miami (Fla.) Hurricanes',
 '127': 'Michigan St. Spartans',
 '2393': 'Middle Tenn. Blue Raiders',
 '270': 'Wisconsin-Milwaukee Panthers',
 '2885': 'New Jersey Tech Highlanders',
 '160': 'New Hamp. Wildcats',
 '166': 'New Mexico St. Aggies',
 '2870': 'PFW Mastodons',
 '2545': 'Southeastern Louisiana Lions',
 '2565': 'SIUE Cougars',
 '2547': 'Seattle Redhawks',
 '2546': 'SE Missouri State Redhawks',
 '2900': 'St. Thomas (MN) Tommies',
 '2634': 'Tenn. State Tigers',
 '326': 'Texas State-San Marcos Bobcats',
 '27': 'California Riverside Highlanders',
 '2540': 'Santa Barbara Gauchos',
 '41': 'Connecticut Huskies',
 '82': 'Illinois-Chicago Flames',
 '2433': 'Louisiana-Monroe Warhawks',
 '2430': 'UNCG Spartans',
 '292': 'UTRGV Vaqueros',
 '2638': 'Texas-El Paso Miners',
 '2636': 'Texas-San Antonio Roadrunners'}
NBA_ALIASES = {"12": "Los Angeles Clippers"}


class TeamDirectoryParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.logos = {}
        self.text = None
        self.logo = None

    def handle_starttag(self, tag, attributes):
        if tag == "tr":
            self.text = []
            self.logo = None
        elif tag == "img" and self.text is not None and self.logo is None:
            src = dict(attributes).get("src", "")
            if CBS_ASSET.fullmatch(src):
                self.logo = src

    def handle_data(self, data):
        if self.text is not None and data.strip():
            self.text.append(data.strip())

    def handle_endtag(self, tag):
        if tag == "tr" and self.text is not None:
            if self.text and self.logo:
                self.logos[normalize_name(self.text[0])] = self.logo
            self.text = None


def normalize_name(value):
    value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode()
    return re.sub("[^a-z0-9]", "", value.lower().replace("&", "and"))


def fetch(url):
    with urllib.request.urlopen(url, timeout=30) as response:
        return response.read()


def verify_svg(url):
    for attempt in range(2):
        try:
            root = ET.fromstring(fetch(url))
            tags = {element.tag.split("}")[-1].lower() for element in root.iter()}
            if root.tag.split("}")[-1] != "svg" or tags & {"script", "foreignobject"}:
                raise ValueError(f"Unexpected SVG markup at {url}")
            return
        except Exception:
            if attempt:
                raise
            time.sleep(0.2)


def main():
    logos = {}
    teams = {}
    for league, (cbs_path, espn_path) in DIRECTORIES.items():
        parser = TeamDirectoryParser()
        parser.feed(fetch(f"https://www.cbssports.com/{cbs_path}/teams/").decode())
        logos[league] = parser.logos
        data = json.loads(fetch(f"https://site.api.espn.com/apis/site/v2/sports/{espn_path}/teams?limit=1000"))
        teams[league] = {row["team"]["id"]: row["team"] for row in data["sports"][0]["leagues"][0]["teams"]}

    # College scoreboards share ESPN school IDs. Use CBS football logos where
    # CBS lists that school in both directories.
    by_league = {}
    by_guid = {}
    sources = {
        "nba": (logos["nba"], teams["nba"], NBA_ALIASES, teams["nba"]),
        "nfl": (logos["nfl"], teams["nfl"], {}, teams["nfl"]),
        "ncaa": (logos["cbb"] | logos["cfb"], teams["cfb"] | teams["cbb"], COLLEGE_ALIASES, teams["cbb"]),
    }
    for league, (directory, entries, aliases, required) in sources.items():
        matches = {}
        for team_id, team in entries.items():
            name = team["displayName"]
            alias = aliases.get(team_id, name)
            logo = directory.get(normalize_name(alias)) or directory.get(normalize_name(name))
            if not logo:
                continue
            matches[team_id] = logo
            if league != "ncaa":
                matches[team["abbreviation"].lower()] = logo
            for entry in team.get("logos", []):
                guid = ESPN_GUID.search(entry["href"])
                if guid:
                    by_guid[guid[1]] = logo

        missing = required.keys() - matches.keys()
        if missing:
            raise ValueError(f"Missing {league} logo mappings for ESPN IDs {sorted(missing)}")
        by_league[league] = matches

    urls = set(by_guid.values()) | {url for mapping in by_league.values() for url in mapping.values()}
    with ThreadPoolExecutor(max_workers=12) as pool:
        list(pool.map(verify_svg, sorted(urls)))

    def asset_ids(mapping):
        return {key: CBS_ASSET.fullmatch(url)[1] for key, url in sorted(mapping.items())}

    leagues = json.dumps({league: asset_ids(mapping) for league, mapping in by_league.items()}, indent=2)
    guids = json.dumps(asset_ids(by_guid), indent=2)
    output = (
        "// Generated by scripts/sync-cbs-logos.py; verified CBS SVG assets.\n"
        f"export const CBS_BY_LEAGUE: Readonly<Record<string, Readonly<Record<string, string>>>> = {leagues};\n"
        f"export const CBS_BY_ESPN_GUID: Readonly<Record<string, string>> = {guids};\n"
    )
    (Path(__file__).resolve().parents[1] / "lib/cbsLogos.ts").write_text(output)
    print(f"Verified {len(urls)} CBS SVGs")


if __name__ == "__main__":
    main()
