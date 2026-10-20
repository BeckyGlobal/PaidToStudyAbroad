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

  // 【可调】每年预算选项对应的上限（万元人民币）
  var BUDGET_MAX = { lt10: 10, b10_20: 20, b20_30: 30, b30_50: 50, gt50: 9999, unsure: null };

  // 【可调】预算比项目最低要求多出不到这么多（万元）时，算“预算比较紧”
  var TIGHT_MARGIN = 2;

  // 【可调】雅思分数和托福、多邻国的粗略对照，只用来判断“英语够不够”。
  // 这是本工具的估计，不是任何学校的官方换算，各项目以官网分数为准。
  var EN_MAP = [[5.5, 70, 100], [6.0, 80, 110], [6.5, 90, 115], [7.0, 100, 125], [7.5, 105, 130]];

  // 【可调】用户排的第 1、2、3 个目标各占多少分量
  var GOAL_WEIGHT = [3, 2, 1, 1, 1, 1, 1];

  // 【可调】分组线：总分达到多少算“很匹配”“可以考虑”
  var TIER_GOOD = 10;
  var TIER_OK = 6;

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
    return !!((e.ielts && e.ielts >= need) || (e.toefl && e.toefl >= row[1]) || (e.duolingo && e.duolingo >= row[2]));
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

  var ROUTE_SCORE = { direct: 4, foundation: 3, conditional: 2, hard: 1 };
  var LANG_SCORE = { has: 3, learn: 1 };

  function goalScore(country, prog, p) {
    var s = 0, hits = [];
    (p.goals || []).forEach(function (g, i) {
      var fit = (country.goal_fit || {})[g];
      var w = GOAL_WEIGHT[i] || 1;
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
      if (m.min_age && p.age && p.age < m.min_age) { out.skipped.push({ prog: prog, why: '一般 ' + m.min_age + ' 岁以上才去' }); return; }

      // fits = 为什么适合这个孩子；notes = 要注意的坎
      var fits = [], notes = [];
      var acc = access(m.access_rules, p);
      if (acc.route === 'none') { out.skipped.push({ prog: prog, why: acc.text || '入学条件不符合' }); return; }
      if (acc.text) { if (acc.route === 'direct' || acc.route === 'foundation') fits.push(acc.text); else notes.push(acc.text); }
      p._route = acc.route;

      var lc = langCheck(m.lang, p);
      if (lc.st === 'no') { out.skipped.push({ prog: prog, why: lc.text }); return; }
      if (lc.text) { if (lc.st === 'has') fits.push(lc.text); else notes.push(lc.text); }

      // 不知道最低花费时按“不确定”给 1 分，免得没数字的项目排得太前
      var bScore = (m.min_budget == null && budgetMax != null) ? 1 : 2;
      if (m.min_budget != null && budgetMax != null) {
        if (budgetMax < m.min_budget) {
          out.skipped.push({ prog: prog, why: m.budget_reason_zh || ('每年最低大约要 ' + m.min_budget + ' 万元，超过你填的预算') });
          return;
        }
        if (budgetMax < m.min_budget + TIGHT_MARGIN) { bScore = 1; notes.push(m.tight_note_zh || '预算比较紧，要选最便宜的学校和城市'); }
        else if (m.min_budget > 0) fits.push('你填的预算够付每年约 ' + m.min_budget + ' 万元的最低花费');
      }

      if (m.parent_visa != null && p.parent === 'yes' && prog.type === 'k12') {
        if (m.parent_visa) fits.push(m.parent_visa_zh || '家长可以办陪读签证');
        else notes.push(m.parent_visa_zh || '这里没有家长陪读签证');
      }

      (m.fit_if || []).forEach(function (f) { if (condOk(f, p)) fits.push(fill(f.text_zh, p)); });
      (m.note_if || []).forEach(function (f) { if (condOk(f, p)) notes.push(fill(f.text_zh, p)); });

      var g = goalScore(country, prog, p);
      if (m.field_boost && m.field_boost.indexOf(p.field) >= 0) g.score += 1;
      g.hits.forEach(function (h) { if (fits.indexOf(h) < 0) fits.push(h); });
      if (!fits.length) fits.push('符合基本入学条件');

      var total = (ROUTE_SCORE[acc.route] || 1) + (LANG_SCORE[lc.st] || 1) + bScore + g.score;
      var tier = total >= TIER_GOOD ? 1 : total >= TIER_OK ? 2 : 3;
      if (prog.suitable === 'limited' && tier < 2) tier = 2;
      if (acc.route === 'hard') tier = 3;
      // 已有本科或硕士学位、又没选“学门技术尽快工作”的，职业教育和大专最多放在“可以考虑”
      if ((prog.type === 'vocational' || prog.type === 'associate') && (p.stage === 'bachelor_done' || p.stage === 'master_done') &&
          (p.goals || []).indexOf('skill_job') < 0 && p.field !== 'skill' && tier < 2) tier = 2;

      out.picks.push({ country: country, prog: prog, tier: tier, score: total, route: acc.route, lang: lc,
        fits: fits, notes: notes });
    });
    return out;
  }

  window.MatchRules = { evaluate: evaluate, BUDGET_MAX: BUDGET_MAX, LANG_NAME: LANG_NAME };
})();
