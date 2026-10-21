/*
  留学方向初筛 · 推荐规则
  ------------------------------------------------------------
  这个文件只放“怎么判断”的通用规则；每个国家和地区的入学条件、费用、
  语言要求都写在数据里（data.js）。
  想调整推荐结果，改下面带【可调】的数字就行。
  这些规则只指方向，不预测录取，也不代表任何国家的官方标准。
*/
(function () {
  'use strict';

  // 【可调】总预算选项对应的上限（万元人民币，学费加生活费，整个读完的钱）
  var BUDGET_MAX = { lt30: 30, b30_60: 60, b60_100: 100, b100_200: 200, gt200: 99999, unsure: null };

  // 【可调】总预算比读完最低花费多出不到这个比例时，算“预算比较紧”
  var TIGHT_RATIO = 1.15;

  // 【可调】数据里没写读几年时，按这个年数估算
  var DEFAULT_YEARS = { foundation: 1, vocational: 2, associate: 2, bachelor: 4, master: 2, phd: 4 };

  // 读完最少要几年：中小学按读到 18 岁算；要先读预科或语言的本科加 1 年
  function minYears(prog, p, route) {
    var d = prog.duration_years, y;
    if (prog.type === 'k12') y = p.age ? Math.max(1, Math.min(12, 18 - p.age)) : 3;
    else if (Array.isArray(d)) y = d[0];
    else if (typeof d === 'number') y = d;
    else y = DEFAULT_YEARS[prog.type] || 2;
    if (prog.type === 'bachelor' && route === 'foundation') y += 1;
    return y;
  }
  function wan(x) { return x >= 10 ? Math.round(x) : Math.round(x * 10) / 10; }

  // 【可调】出国读中小学的学生，中学毕业后多数接着在当地读大学（多数按国际生交学费）。
  // 所以中小学的总预算要把当地本科最少要花的钱一起算进去；改成 false 就只算中小学。
  var K12_ADD_COLLEGE = true;
  function collegeAfterK12(country) {
    if (!K12_ADD_COLLEGE) return null;
    var b = null;
    country.programs.forEach(function (q) {
      var qm = q.match || {};
      if (!b && q.type === 'bachelor' && qm.min_budget != null && !qm.never && q.suitable !== 'no') b = q;
    });
    if (!b) return null;
    var d = b.duration_years, y = Array.isArray(d) ? d[0] : (typeof d === 'number' ? d : DEFAULT_YEARS.bachelor);
    return { annual: b.match.min_budget, years: y, total: wan(b.match.min_budget * y) };
  }

  // 【可调】雅思分数和托福、多邻国、PTE 的粗略对照，只用来判断“英语够不够”。
  // 托福、多邻国是本工具的估计；PTE 取培生 2025 年 7 月官方对照表里每档的最低分。各项目以官网分数为准。
  var EN_MAP = [[5.5, 70, 100, 39], [6.0, 80, 110, 47], [6.5, 90, 115, 55], [7.0, 100, 125, 63], [7.5, 105, 130, 71]];

  // 【可调】用户排的第 1、2、3 个目标各占多少分量
  var GOAL_WEIGHT = [3, 2, 1, 1, 1, 1, 1];

  // 【可调】分组线：总分达到多少算“很匹配”“可以考虑”
  var TIER_GOOD = 8;
  var TIER_OK = 5;

  var LEVELS = ['none', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
  function lv(x) { var i = LEVELS.indexOf(x || 'none'); return i < 0 ? 0 : i; }

  var LANG_NAME = { de: '德语', en: '英语', ja: '日语', ko: '韩语', fr: '法语', es: '西班牙语', it: '意大利语', nl: '荷兰语',
    pt: '葡萄牙语', pl: '波兰语', cs: '捷克语', sk: '斯洛伐克语', hu: '匈牙利语', sv: '瑞典语', da: '丹麦语', fi: '芬兰语',
    no: '挪威语', is: '冰岛语', el: '希腊语', ro: '罗马尼亚语', bg: '保加利亚语', hr: '克罗地亚语', sl: '斯洛文尼亚语',
    et: '爱沙尼亚语', lv: '拉脱维亚语', lt: '立陶宛语', he: '希伯来语', mt: '马耳他语', zh: '中文', yue: '粤语' };

  var STAGE_REASON = {
    k12: '学历阶段不在中小学范围',
    foundation: '这个学历阶段不需要或不能读预科',
    vocational: '这个学历阶段一般不走职业教育',
    associate: '这个学历阶段不适合读大专',
    bachelor: '这个学历背景暂时走不通本科',
    master: '要先有本科学位',
    phd: '要先有硕士学位'
  };

  // 英语：给定雅思线，看用户的雅思、托福、多邻国有没有一个够
  function englishMeets(p, ielts) {
    var e = p.en || {}, need = ielts || 6.0, row = EN_MAP[0];
    for (var i = 0; i < EN_MAP.length; i++) if (EN_MAP[i][0] <= need) row = EN_MAP[i];
    return !!((e.ielts && e.ielts >= need) || (e.toefl && e.toefl >= row[1]) || (e.duolingo && e.duolingo >= row[2]) || (e.pte && e.pte >= row[3]));
  }

  // 语言判断：has = 现在就够；learn = 要先学；no = 用户不想学新语言
  function langCheck(opts, p) {
    if (!opts || !opts.length) return { st: 'has', text: '' };
    var learnable = null;
    for (var i = 0; i < opts.length; i++) {
      var o = opts[i];
      if (o.lang === 'en') {
        if (englishMeets(p, o.ielts)) return { st: 'has', text: '英语成绩够上英语授课的课' + (o.ielts ? '（多数项目要雅思 ' + o.ielts + ' 左右）' : '（具体分数看项目）') };
        if (!learnable) learnable = { st: 'learn', text: '要把英语提到' + (o.ielts ? '雅思 ' + o.ielts + ' 左右' : '能上课的水平') + '，考雅思或托福' };
      } else {
        var name = LANG_NAME[o.lang] || o.lang, have = (p.langs || {})[o.lang];
        if (lv(have) >= lv(o.level)) return { st: 'has', text: '你的' + name + '已经达到 ' + o.level };
        if (p.newLang !== 'no' && !learnable) learnable = { st: 'learn', text: '要先把' + name + '学到 ' + o.level + (o.exam_zh ? '（' + o.exam_zh + '）' : '') };
      }
    }
    if (learnable) return learnable;
    var need = opts.map(function (o) { return o.lang === 'en' ? '英语' : (LANG_NAME[o.lang] || o.lang) + ' ' + o.level; }).join(' 或 ');
    return { st: 'no', text: '要' + need + '，你选了不想学新语言' };
  }

  // 条件写法：stages、gaokao(known/unknown)、gaokao_min、gaokao_max、semesters_min、
  // semesters_unknown、age_min、age_max、field、parent、grades、when_route（只用于 fit_if / note_if）
  function condOk(c, p) {
    if (c.stages && c.stages.indexOf(p.stage) < 0) return false;
    if (c.gaokao === 'known' && p.gaokaoPct == null) return false;
    if (c.gaokao === 'unknown' && p.gaokaoPct != null) return false;
    if (c.gaokao_min != null && (p.gaokaoPct == null || p.gaokaoPct < c.gaokao_min)) return false;
    if (c.gaokao_max != null && (p.gaokaoPct == null || p.gaokaoPct >= c.gaokao_max)) return false;
    if (c.semesters_min != null && (p.semesters == null || p.semesters < c.semesters_min)) return false;
    if (c.semesters_unknown && p.semesters != null) return false;
    if (c.age_min != null && (p.age == null || p.age < c.age_min)) return false;
    if (c.age_max != null && (p.age == null || p.age > c.age_max)) return false;
    if (c.field && c.field.indexOf(p.field) < 0) return false;
    if (c.parent && c.parent !== p.parent) return false;
    if (c.grades && c.grades.indexOf(p.grades) < 0) return false;
    if (c.when_route && c.when_route !== p._route) return false;
    return true;
  }
  function fill(t, p) {
    return String(t || '').replace(/\{pct\}/g, p.gaokaoPct).replace(/\{sem\}/g, p.semesters).replace(/\{age\}/g, p.age);
  }

  // 入学路径：direct 直接申请 / foundation 先读预科或语言 / conditional 看将来成绩 / hard 要先多读几年 / none 走不通
  function access(rules, p) {
    if (!rules || !rules.length) return { route: 'direct', text: '' };
    for (var i = 0; i < rules.length; i++) if (condOk(rules[i], p)) return { route: rules[i].route, text: fill(rules[i].text_zh, p) };
    return { route: 'conditional', text: '具体入学条件看学校官网' };
  }

  // 【可调】目标和项目类型对不对口：想冲名校/拿好学历的，大学类加分、职业类减分；想学技术尽快工作的反过来
  var TYPE_GOAL = {
    top_school: { bachelor: 1, master: 1, phd: 1, vocational: -2, associate: -2 },
    degree_home: { bachelor: 1, master: 1, phd: 1, vocational: -2, associate: -2 },
    skill_job: { vocational: 1, associate: 1, bachelor: -1, master: -1, phd: -2 }
  };

  // 【可调】好找工作的专业：哪些项目类型显示、最多显示几条、感兴趣的方向正好紧缺时加几分
  var MAJOR_TYPES = ['vocational', 'associate', 'bachelor', 'master'];
  var MAJOR_MAX = 3;
  var MAJOR_FIELD_BOOST = 0.5;
  var FIELD_NAME = { stem: '理工、计算机', biz: '商科', med: '医学、护理', art: '艺术设计', hum: '文科、社科', skill: '技术手艺' };
  function majorsFor(country, prog, p) {
    var d = country.in_demand;
    if (!d || !d.items || MAJOR_TYPES.indexOf(prog.type) < 0) return [];
    var list = d.items.filter(function (it) { return (it.levels || []).indexOf(prog.type) >= 0; });
    // 感兴趣的方向排前面，其余保持官方紧缺程度的顺序
    var mine = list.filter(function (it) { return it.field === p.field; });
    var rest = list.filter(function (it) { return it.field !== p.field; });
    return mine.concat(rest).slice(0, MAJOR_MAX);
  }

  // 【可调】应届生在当地找工作的真实难度（jobs/ 数据，按官方就业结果定）：
  // 想“留在当地工作”“拿当地身份”时，这一项的得分最多到这个数，难的地方自然往后排
  var JOB_CAP = { easy: 2, medium: 1, hard: 0 };
  var JOB_TYPES = ['vocational', 'associate', 'bachelor', 'master', 'phd'];
  var JOB_WORD = { easy: '相对容易', medium: '一般', hard: '难' };

  var ROUTE_SCORE = { direct: 4, foundation: 3, conditional: 2, hard: 1 };
  var LANG_SCORE = { has: 3, learn: 1 };

  function goalScore(country, prog, p) {
    var s = 0, hits = [];
    (p.goals || []).forEach(function (g, i) {
      var fit = (country.goal_fit || {})[g];
      var w = GOAL_WEIGHT[i] || 1;
      var jm = country.job_market;
      if (fit && jm && JOB_CAP[jm.level] != null && (g === 'local_job' || g === 'immigrate')) {
        fit = { score: Math.min(fit.score, JOB_CAP[jm.level]), why_zh: fit.why_zh };
      }
      var boost = ((prog.match || {}).goal_boost || []).indexOf(g) >= 0 ? 1 : 0;
      if (fit) {
        s += (fit.score + boost) * w / 3;
        if (fit.score + boost >= 2 && fit.why_zh) hits.push(fit.why_zh);
      }
    });
    (p.goals || []).forEach(function (g, i) {
      var adj = (TYPE_GOAL[g] || {})[prog.type];
      if (adj) s += adj * (GOAL_WEIGHT[i] || 1) / 3;
    });
    return { score: Math.max(Math.min(s, 4), -3), hits: hits };
  }

  function evaluate(country, p) {
    var out = { picks: [], skipped: [] };
    var budgetMax = BUDGET_MAX[p.budget];
    country.programs.forEach(function (prog) {
      var m = prog.match || {};
      if (m.is_step || m.never || prog.suitable === 'no') return;

      if (m.stages && m.stages.indexOf(p.stage) < 0) {
        out.skipped.push({ prog: prog, kind: 'stage', why: m.stage_reason_zh || STAGE_REASON[prog.type] || '学历阶段不合适' });
        return;
      }
      if (m.max_age && p.age && p.age > m.max_age) { out.skipped.push({ prog: prog, why: '年龄超过 ' + m.max_age + ' 岁' }); return; }
      // 【可调】差 2 岁以内的照样列出来，提醒满几岁才能入学；差得更多的先不列
      var ageNote = '';
      if (m.min_age && p.age && p.age < m.min_age) {
        if (m.min_age - p.age > 2) { out.skipped.push({ prog: prog, why: '一般 ' + m.min_age + ' 岁以上才去' }); return; }
        ageNote = '要满 ' + m.min_age + ' 岁才能入学，现在可以先准备';
      }

      // fits = 为什么能去；notes = 要注意的坎
      var fits = [], notes = [];
      var acc = access(m.access_rules, p);
      if (acc.route === 'none') { out.skipped.push({ prog: prog, why: acc.text || '入学条件不符合' }); return; }
      if (acc.text) { if (acc.route === 'direct' || acc.route === 'foundation') fits.push(acc.text); else notes.push(acc.text); }
      if (ageNote) notes.push(ageNote);
      p._route = acc.route;

      var lc = langCheck(m.lang, p);
      if (lc.st === 'no') { out.skipped.push({ prog: prog, why: lc.text }); return; }
      if (lc.text) { if (lc.st === 'has') fits.push(lc.text); else notes.push(lc.text); }

      // 不知道最低花费时按“不确定”给 1 分，免得没数字的项目排得太前
      var bScore = (m.min_budget == null && budgetMax != null) ? 1 : 2;
      var yrs = minYears(prog, p, acc.route), need = m.min_budget != null ? wan(m.min_budget * yrs) : null;
      var needTxt = need != null ? '读完最少约 ' + need + ' 万元（学费加生活费，每年约 ' + m.min_budget + ' 万 × ' + yrs + ' 年）' : '';
      var college = prog.type === 'k12' ? collegeAfterK12(country) : null;
      if (college) {
        // 中小学：读到 18 岁的钱 + 中学毕业后在当地读本科的钱
        var colPart = '中学毕业后在当地读本科最少约 ' + college.total + ' 万（每年约 ' + college.annual + ' 万 × ' + college.years + ' 年）';
        // 数据里中小学没有“每年花费”区间时，min_budget 只是签证要求的生活费，学费没算进去
        var k12Partial = need != null && !Array.isArray(prog.annual_cost_cny_wan);
        if (need != null) {
          needTxt = '一直读到大学毕业' + (k12Partial ? '至少 ' : '最少约 ') + wan(need + college.total) + ' 万元：中小学读到 18 岁' +
            (k12Partial ? '光生活费就约 ' + need + ' 万（每年约 ' + m.min_budget + ' 万 × ' + yrs + ' 年，学费按学校报价另算）'
                        : '约 ' + need + ' 万（每年约 ' + m.min_budget + ' 万 × ' + yrs + ' 年）') + '，' + colPart;
          need = wan(need + college.total);
        } else {
          needTxt = '光是' + colPart + '，中小学这几年的学费按学校报价，要另外加';
          need = college.total;
        }
        var k12Open = k12Partial || m.min_budget == null;
        if (k12Open) bScore = 1;
      }
      if (need != null && budgetMax != null) {
        if (budgetMax < need) {
          out.skipped.push({ prog: prog, why: needTxt + '，超过你填的总预算' });
          return;
        }
        if (budgetMax < need * TIGHT_RATIO) { bScore = 1; notes.push('总预算比较紧：' + needTxt + '。' + (m.tight_note_zh || '要选最便宜的学校和城市')); }
        else if (college && k12Open) notes.push('算预算时别漏了大学：' + needTxt + (m.min_budget == null ? '。两段加起来看够不够' : '。再加上中小学学费，看够不够'));
        else if (need > 0) fits.push('你填的总预算够用：' + needTxt);
      }
      if (college && budgetMax == null) notes.push('算预算时别漏了大学：' + needTxt);
      if (prog.type === 'k12' && !college && K12_ADD_COLLEGE) notes.push('算预算时别漏了大学：中学毕业后多数接着在当地读大学，大学的学费和生活费也要算进总预算');

      if (m.parent_visa != null && p.parent === 'yes' && prog.type === 'k12') {
        if (m.parent_visa) fits.push(m.parent_visa_zh || '家长可以办陪读签证');
        else notes.push(m.parent_visa_zh || '这里没有家长陪读签证');
      }

      (m.fit_if || []).forEach(function (f) { if (condOk(f, p)) fits.push(fill(f.text_zh, p)); });
      (m.note_if || []).forEach(function (f) { if (condOk(f, p)) notes.push(fill(f.text_zh, p)); });

      var g = goalScore(country, prog, p);
      if (m.field_boost && m.field_boost.indexOf(p.field) >= 0) g.score += 1;
      var jm = country.job_market && JOB_CAP[country.job_market.level] != null && JOB_TYPES.indexOf(prog.type) >= 0 ? country.job_market : null;
      var majors = majorsFor(country, prog, p);
      var wantsStay = (p.goals || []).some(function (gg) { return gg === 'local_job' || gg === 'immigrate'; });
      if (jm && wantsStay) {
        if (jm.level === 'easy') fits.push('毕业后在当地找工作相对容易，数据见下面');
        else notes.unshift('你想毕业后留在当地，但这里非本地应届生找工作' + JOB_WORD[jm.level] + '，先看下面「毕业后在当地找工作」的官方数据');
      }
      var hot = majors.filter(function (it) { return it.field === p.field; });
      if (hot.length) {
        g.score += MAJOR_FIELD_BOOST;
        fits.unshift('感兴趣的' + FIELD_NAME[p.field] + '方向在当地' + (jm && jm.level !== 'easy' ? '紧缺职业名单上' : '好找工作') + '：' + hot.slice(0, 2).map(function (it) { return it.major_zh; }).join('、'));
      }
      g.hits.forEach(function (h) { if (fits.indexOf(h) < 0) fits.push(h); });
      if (!fits.length) fits.push('符合基本入学条件');

      var total = (ROUTE_SCORE[acc.route] || 1) + (LANG_SCORE[lc.st] || 1) + bScore + g.score;
      var tier = total >= TIER_GOOD ? 1 : total >= TIER_OK ? 2 : 3;
      if (prog.suitable === 'limited' && tier < 2) tier = 2;
      if (acc.route === 'hard') tier = 3;
      // 想留在当地、但当地外国应届生找工作难的，最多放在“可以考虑”，并往后排
      if (jm && wantsStay && jm.level === 'hard') { total -= 1; if (tier < 2) tier = 2; }
      // 已有本科或硕士学位、又没选“学门技术尽快工作”的，职业教育和大专最多放在“可以考虑”
      if ((prog.type === 'vocational' || prog.type === 'associate') && (p.stage === 'bachelor_done' || p.stage === 'master_done') &&
          (p.goals || []).indexOf('skill_job') < 0 && p.field !== 'skill' && tier < 2) tier = 2;

      out.picks.push({ country: country, prog: prog, tier: tier, score: total, route: acc.route, lang: lc,
        fits: fits, notes: notes, years: yrs, college: college, majors: majors, jobs: jm, need: need });
    });
    return out;
  }

  window.MatchRules = { evaluate: evaluate, BUDGET_MAX: BUDGET_MAX, LANG_NAME: LANG_NAME, minYears: minYears, access: access, STAGE_REASON: STAGE_REASON };
})();
