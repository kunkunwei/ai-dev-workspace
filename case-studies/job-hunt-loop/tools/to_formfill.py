#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
profile.yaml  ->  在线表单填表扩展可导入的标准简历 JSON

为什么需要它：
    填表扩展的「导入标准简历」只吃它自己的 JSON 格式（kind: "resume-profile"）。
    本脚本把唯一事实源 data/profile.yaml 转成扩展能直接导入的格式，
    省掉手工逐字段填。它只是「搬运 + 结构化」，不调模型、不会幻觉。

用法：
    python tools/to_formfill.py                # 生成到 tools/out/
    python tools/to_formfill.py --print        # 只打印，不写文件

然后：
    扩展侧边栏 -> 「导入标准简历」-> 选 tools/out/标准简历-YYYY-MM-DD.json

通用化说明（本文件不含任何个人默认值）：
    - profile.yaml 里没有的值一律留空字符串，并在结尾报告里列出来。
      不做「合理的默认值」填充 —— 填错表比不填更糟。
    - 国家、时区、手机区号、GitHub 链接、默认 summary 等个人/区域值
      一律从 profile.yaml 读取；没写就是空，绝不硬编码。
    - 转换只做「搬运 + 结构化」，不改写文字内容。
"""
import argparse
import datetime as dt
import json
import pathlib
import re
import sys

try:
    import yaml
except ImportError:
    sys.exit("缺 pyyaml：pip install pyyaml")

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent                      # <求职目录>/
PROFILE_YAML = ROOT / "data" / "profile.yaml"
OUT_DIR = HERE / "out"

APP_ID = "ai-resume-form-filling-assistant"
KIND = "resume-profile"

# 报告用：记录哪些字段是从源文件推导/映射的（不是硬编码）
INFERRED = []


def s(v):
    """安全转字符串：YAML 会把纯数字解析成 int/float"""
    if v is None:
        return ""
    if isinstance(v, float) and v == int(v):
        return str(int(v))
    return str(v).strip()


def split_period(period):
    """'2023.09~2027.06' / '2026.07~至今' -> ('2023-09', '2027-06')"""
    if not period:
        return "", ""
    m = re.split(r"\s*[~\-–—]{1,2}\s*", s(period))
    if len(m) != 2:
        return "", ""
    out = []
    for part in m:
        part = part.strip()
        if part in ("至今", "现在", "present", "now", ""):
            out.append("")
            continue
        mm = re.match(r"^(\d{4})[.\-/]?(\d{1,2})?$", part)
        out.append(f"{mm.group(1)}-{int(mm.group(2)):02d}" if mm and mm.group(2) else (mm.group(1) if mm else part))
    return out[0], out[1]


def join_bullets(items):
    return "\n".join(s(x) for x in (items or []) if s(x))


def build(pf):
    basic = pf.get("basic") or {}
    intent = pf.get("job_intent") or {}
    profile = {}

    # ── personal 基本信息 ────────────────────────────────────
    courses = basic.get("courses") or []
    edu = (pf.get("education") or [{}])[0]
    intern = (pf.get("internships") or [{}])[0]

    profile["personal"] = {
        "fullName": s(basic.get("name")),
        "firstName": "", "middleName": "", "lastName": "", "preferredName": "", "englishName": "",
        "gender": "",                       # profile.yaml 无则留空
        "birthDate": "",                    # profile.yaml 只到月，扩展要 date 格式，留空手工填
        "age": "",
        "email": s(basic.get("email")),
        "alternateEmail": "",
        "phoneCountryCode": s(basic.get("phone_country_code")),   # 例：+86，源文件没有就留空
        "phoneNumber": s(basic.get("phone")),
        "alternatePhone": "", "wechatId": "",
        "currentCity": s(basic.get("current_city")),
        "currentProvince": s(basic.get("current_province")),
        "currentCountry": s(basic.get("country")),                # 源文件没有就留空，不硬编码
        "currentDistrict": "",
        "nationality": s(basic.get("nationality")),
        "citizenship": s(basic.get("citizenship")),
        "maritalStatus": "",
        "currentCompany": s(intern.get("company")),
        "currentTitle": s(intern.get("role")),
        "yearsOfExperience": "", "yearsOfManagement": "",
        "highestEducationLevel": s(basic.get("degree")),
        "summary": s(basic.get("summary")),   # 想写「个人优势」就在 profile.yaml 的 basic.summary 写
    }
    if intern.get("company"):
        INFERRED.append("personal.currentCompany / currentTitle —— 取 internships[0]")

    # ── contactAndLocation 联系方式与地址 ────────────────────
    hometown = s(basic.get("hometown"))
    profile["contactAndLocation"] = {
        "currentAddressLine1": "", "currentAddressLine2": "", "postalCode": "",
        "hometownCity": "" if hometown == "UNKNOWN" else hometown,
        "hometownProvince": "",
        "hukouLocation": "",
        "emergencyContactName": "", "emergencyContactPhone": "",
        "timezone": s(basic.get("timezone")),   # 例：Asia/Shanghai；源文件没有就留空
    }

    # ── identityAndAuthorization 证件与资格 ──────────────────
    profile["identityAndAuthorization"] = {
        "personalIdType": "", "personalIdNumber": "", "passportName": "", "passportNumber": "",
        "passportExpiryDate": "",
        "politicalStatus": s(basic.get("political")),
        "workAuthorization": "",   # 需要时写在 profile.yaml 的 basic.work_authorization
        "visaStatus": "", "sponsorshipNeeded": "",
        "driversLicense": "", "securityClearance": "",
    }

    # ── onlinePresence 在线资料 ──────────────────────────────
    profile["onlinePresence"] = {
        "linkedinUrl": "",
        "githubUrl": s(basic.get("github")),      # 例：https://github.com/<用户名>；源文件没有就留空
        "portfolioUrl": "", "websiteUrl": "", "blogUrl": "", "leetcodeUrl": "",
        "otherProfileLinks": s(basic.get("other_links")),
    }

    roles = intent.get("target_roles") or []
    cities = intent.get("cities") or []

    # ── jobPreferences 求职偏好 ──────────────────────────────
    profile["jobPreferences"] = {
        "targetRole": "、".join(s(r) for r in roles),
        "targetLevel": s(intent.get("target_level")),       # 例：应届生（2027 届本科）
        "targetDepartment": "", "targetIndustry": s(intent.get("target_industry")),
        "expectedCity": s(cities[0]) if cities else "",
        "expectedCountry": s(basic.get("country")),
        "preferredLocations": "、".join(s(c) for c in cities),
        "expectedSalary": "", "currentCompensation": "", "noticePeriod": "",
        "availableDate": s(intent.get("available_from")),    # 例：2027-07-01，留空手工填
        "employmentType": s(intent.get("employment_type")),
        "willingToRelocate": s(intent.get("willing_relocate")),
        "willingToTravel": "",
        "remotePreference": s(intent.get("remote_preference")),
        "preferredInterviewLanguage": s(intent.get("interview_language")),
        "preferredStartTime": "",
    }

    # ── skills 技能与亮点 ───────────────────────────────────
    skill_titles = [s(k.get("title")) for k in (pf.get("skills") or []) if s(k.get("title"))]
    skill_texts = [s(k.get("text")) for k in (pf.get("skills") or []) if s(k.get("text"))]
    profile["skills"] = {
        "primarySkills": "\n".join(skill_texts),
        "programmingLanguages": s(basic.get("programming_languages")),
        "frameworks": s(basic.get("frameworks")),
        "aiTools": s(basic.get("ai_tools")),
        "cloudPlatforms": s(basic.get("cloud_platforms")),
        "databases": s(basic.get("databases")),
        "tooling": s(basic.get("tooling")),
        "domainKnowledge": "、".join(skill_titles),
        "managementExperience": "",
        "softSkills": "",
        "notableAchievements": s(basic.get("achievements")),  # 量化成果列表，逐条有证据锚点
        "interests": "",
    }

    # ── educations ──────────────────────────────────────────
    st, en = split_period(basic.get("period"))
    profile["educations"] = [{
        "school": s(basic.get("school")),
        "educationType": s(basic.get("education_type")),   # 例：全国普通高等院校全日制
        "degree": s(basic.get("degree")),
        "studyMode": s(basic.get("study_mode")),
        "major": s(basic.get("major")),
        "minor": "", "faculty": "",
        "className": "", "studentId": "",
        "academicSystem": "",
        "city": s(basic.get("school_city")),
        "country": s(basic.get("country")),
        "startDate": st, "endDate": en,
        "graduationStatus": s(basic.get("graduation_status")),  # 例：预计毕业
        "gpa": "", "ranking": "",
        "laboratory": "", "researchDirection": "", "advisor": "", "thesisTitle": "",
        "courses": "、".join(s(c) for c in courses),
        "description": "",
    }]

    # ── internships ─────────────────────────────────────────
    intern_list = []
    for it in (pf.get("internships") or []):
        a, b = split_period(it.get("period"))
        intern_list.append({
            "company": s(it.get("company")),
            "title": s(it.get("role")),
            "department": s(it.get("department")),
            "city": s(it.get("city")),
            "country": s(it.get("country")),
            "startDate": a, "endDate": b,
            "isCurrent": not b,
            "description": join_bullets(it.get("bullets")),
            "achievements": s(it.get("achievements")),
            "technologies": s(it.get("technologies")),
        })
    profile["internships"] = intern_list

    profile["workExperiences"] = []

    # ── projects ────────────────────────────────────────────
    proj_list = []
    for p in (pf.get("projects") or []):
        a, b = split_period(p.get("period"))
        desc_parts = [s(p.get("description"))]
        if p.get("bullets"):
            desc_parts.append(join_bullets(p.get("bullets")))
        proj_list.append({
            "name": s(p.get("name")),
            "role": s(p.get("role")),
            "organization": s(basic.get("school")),
            "url": "", "repoUrl": "", "demoUrl": "",
            "startDate": a, "endDate": b,
            "description": "\n".join(x for x in desc_parts if x),
            "highlights": join_bullets(p.get("bullets")),
            "technologies": s(p.get("technologies")),   # 在 profile.yaml 的 projects[].technologies 写
        })
    profile["projects"] = proj_list

    profile["campusExperiences"] = []
    profile["certificates"] = []

    # ── languages ───────────────────────────────────────────
    lang_list = []
    for lg in (pf.get("languages") or []):
        lang_list.append({
            "name": s(lg.get("name")),
            "proficiency": s(lg.get("proficiency")),
            "testScore": s(lg.get("test_score")),
        })
    profile["languages"] = lang_list

    # ── additional 补充信息 ─────────────────────────────────
    comp_lines = []
    for c in (pf.get("competitions") or []):
        bits = [s(c.get("name"))]
        meta = [s(c.get("year")) or s(c.get("period")), s(c.get("role"))]
        meta = [m for m in meta if m]
        if meta:
            bits.append("（" + "，".join(meta) + "）")
        entry = "".join(bits)
        if s(c.get("desc")):
            entry += "：" + s(c.get("desc"))
        comp_lines.append(entry)

    profile["additional"] = {
        "awards": s(basic.get("awards")),
        "publications": "", "patents": "", "volunteerExperience": "",
        "competitions": "\n".join(comp_lines),
        "openSourceContributions": s(basic.get("open_source")),  # 例：GitHub 链接；源文件没有就留空
        "references": "", "coverLetterHighlights": "",
        "customNotes": "",
    }

    return profile


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--print", action="store_true", dest="do_print")
    args = ap.parse_args()

    if not PROFILE_YAML.exists():
        sys.exit(f"找不到事实源：{PROFILE_YAML}（先用 examples/profile.example.yaml 建 data/profile.yaml）")

    pf = yaml.safe_load(PROFILE_YAML.read_text(encoding="utf-8"))
    profile = build(pf)

    payload = {
        "app": APP_ID,
        "kind": KIND,
        "version": 1,
        "exportedAt": dt.datetime.now().astimezone().isoformat(timespec="seconds"),
        "name": s((pf.get("basic") or {}).get("name")) or f"标准简历-{dt.date.today().isoformat()}",
        "profile": profile,
        # rawText 留空：扩展的 AI 字段映射可以直接用结构化 profile，不需要原文
        "rawText": "",
    }

    # ── 统计：哪些字段填了、哪些留空 ──
    filled = blank = 0

    def walk(o):
        nonlocal filled, blank
        if isinstance(o, dict):
            for v in o.values():
                walk(v)
        elif isinstance(o, list):
            for v in o:
                walk(v)
        elif isinstance(o, str):
            if o.strip():
                filled += 1
            else:
                blank += 1

    walk(profile["personal"]); walk(profile["contactAndLocation"])
    walk(profile["identityAndAuthorization"]); walk(profile["onlinePresence"])
    walk(profile["jobPreferences"]); walk(profile["skills"])
    walk(profile["educations"]); walk(profile["internships"])
    walk(profile["projects"]); walk(profile["campusExperiences"])
    walk(profile["certificates"]); walk(profile["languages"])
    walk(profile["additional"])

    if args.do_print:
        # stdout 只输出纯 JSON，方便管道解析（统计信息走 stderr）
        print(json.dumps(payload, ensure_ascii=False, indent=2))
    else:
        OUT_DIR.mkdir(parents=True, exist_ok=True)
        out = OUT_DIR / f"标准简历-{dt.date.today().isoformat()}.json"
        out.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"已生成：{out}")
        print(f"        {out.stat().st_size:,} B")

    print(f"\n填写统计：有值 {filled} 项 / 留空 {blank} 项", file=sys.stderr)
    print(f"  教育 {len(profile['educations'])} 条 / 实习 {len(profile['internships'])} 条 / "
          f"项目 {len(profile['projects'])} 条", file=sys.stderr)

    if INFERRED:
        print("\n[!] 有据可依的映射（源文件没有的字段保持留空）：", file=sys.stderr)
        for x in INFERRED:
            print(f"   - {x}", file=sys.stderr)


if __name__ == "__main__":
    main()
