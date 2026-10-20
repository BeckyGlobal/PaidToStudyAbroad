/*
  留学方向初筛 · 推荐规则
  ------------------------------------------------------------
  这个文件只放“怎么判断”的规则，国家数据在 data.js 里。
  想调整推荐结果，改下面带【可调】的数字就行。
  这些规则只指方向，不预测录取，也不代表任何国家的官方标准。
*/
(function () {
  'use strict';

  // 【可调】每年预算选项对应的上限（万元人民币）
  var BUDGET_MAX = { lt10: 10, b10_20: 20, b20_30: 30, b30_50: 50, gt50: 9999, unsure: null };

  // 【可调】预算比项目最低要求多出不到这么多（万元）时，算“预算比较紧”
  var TIGHT_MARGIN = 2;

  // 【可调】英语“够用来上英语授课的课”的粗略线。
  // 这是本工具的估计，不是任何学校的官方要求，各项目以官网分数为准。
  var EN_STUDY = { ielts: 6.0, toefl: 80, duolingo: 110 };

  // 【可调】用户排的第 1、2、3 个目标各占多少分量
  var GOAL_WEIGHT = [3, 2, 1, 1, 1, 1, 1];

  // 【可调】分组线：总分达到多少算“很匹配”“可以考虑”
  var TIER_GOOD = 9;
  var TIER_OK = 6;

  var LEVELS = ['none', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
  function lv(x) { var i = LEVELS.indexOf(x || 'none'); return i < 0 ? 0 : i; }

  var LANG_NAME = { de: '德语', en: '英语', ja: '日语', ko: '韩语', fr: '法语', es: '西班牙语', it: '意大利语', nl: '荷兰语' };

  function englishOk(p) {
    var e = p.en || {};
    if (e.ielts && e.ielts >= EN_STUDY.ielts) return true;
    if (e.toefl && e.toefl >= EN_STUDY.toefl) return true;
    if (e.duolingo && e.duolingo >= EN_STUDY.duolingo) return true;
    return false;
  }

  // 语言判断：has = 现在就够；learn = 要先学；no = 用户不想学新语言
  function langCheck(opts, p) {
    if (!opts || !opts.length) return { st: 'has', text: '' };
    var learnable = null;
    for (var i = 0; i < opts.length; i++) {
      var o = opts[i];
      if (o.lang === 'en') {
        if (englishOk(p)) return { st: 'has', text: '英语成绩够上英语授课的课（具体分数看项目）' };
        if (!learnable) learnable = { st: 'learn', text: '要把英语提到能上课的水平，考雅思或托福（分数看项目）' };
      } else {
        var have = (p.langs || {})[o.lang];
        if (lv(have) >= lv(o.level)) return { st: 'has', text: '你的' + LANG_NAME[o.lang] + '已经达到 ' + o.level };
        if (p.newLang !== 'no' && !learnable) learnable = { st: 'learn', text: '要先把' + LANG_NAME[o.lang] + '学到 ' + o.level };
      }
    }
    if (learnable) return learnable;
    var need = opts.map(function (o) { return o.lang === 'en' ? '英语' : LANG_NAME[o.lang] + ' ' + o.level; }).join(' 或 ');
    return { st: 'no', text: '要' + need + '，你选了不想学新语言' };
  }

  // ---------- 各国的特殊入学规则 ----------
  // 返回 route：direct 直接申请 / foundation 先读预科 / conditional 看将来成绩 / hard 要先多读几年 / none 走不通
  var ACCESS = {};

  // 德国：按 APS 2026年9月15日起的规则
  ACCESS.de_foundation = function (p) {
    if (p.stage === 'zhuanke3_done') return { route: 'foundation', text: '三年制专科毕业，可以读预科后考 FSP' };
    if (p.stage === 'gaokao_done') {
      if (p.gaokaoPct == null) return { route: 'conditional', text: '高考达到总分 60% 才能读预科' };
      if (p.gaokaoPct >= 70) return { route: 'none', text: '你的高考已到 70%，可以直接申请本科，不用读预科' };
      if (p.gaokaoPct >= 60) return { route: 'foundation', text: '高考 ' + p.gaokaoPct + '%，达到 60% 的预科线' };
      return { route: 'none', text: '高考 ' + p.gaokaoPct + '%，没到读预科要求的 60%' };
    }
    return { route: 'none', text: '' };
  };

  ACCESS.de_bachelor = function (p) {
    var pct = p.gaokaoPct;
    switch (p.stage) {
      case 'primary': case 'junior': case 'senior':
        return { route: 'conditional', text: '看将来高考：达到总分 70% 可直接申请，60%–70% 先读预科' };
      case 'gaokao_done':
        if (pct == null) return { route: 'conditional', text: '填上高考分数才能判断：70% 以上直接申请，60%–70% 先读预科' };
        if (pct >= 70) return { route: 'direct', text: '高考 ' + pct + '%，达到 70%，可以直接申请相关专业本科' };
        if (pct >= 60) return { route: 'foundation', text: '高考 ' + pct + '%，要先读 1 年预科，考过 FSP 再读本科' };
        return { route: 'hard', text: '高考 ' + pct + '%，没到 60%。要先在国内读本科满 4 个学期，才能申请' };
      case 'nogaokao_done':
        return { route: 'none', text: '没参加高考的高中毕业生，不能凭高中学历申请德国本科' };
      case 'zhuanke3_in':
        return { route: 'hard', text: '三年制专科毕业后，可以先读预科再读本科' };
      case 'zhuanke3_done':
        return { route: 'foundation', text: '三年制专科毕业，先读预科考过 FSP，再读相关专业本科' };
      case 'bachelor_in':
        if (p.semesters == null) return { route: 'conditional', text: '填上已读几个学期才能判断：读满 4 个学期可直接申请（高考 60% 以上读满 2 个学期即可）' };
        if (p.semesters >= 4 || (p.semesters >= 2 && pct != null && pct >= 60))
          return { route: 'direct', text: '你在国内已读 ' + p.semesters + ' 个学期，可以直接申请相关专业本科' };
        return { route: 'hard', text: '国内本科读满 4 个学期后可以直接申请（高考 60% 以上读满 2 个学期即可）' };
      case 'bachelor_done':
        return { route: 'direct', text: '本科毕业有学位，不限专业，可以直接申请' };
      case 'zhuanke2':
        return { route: 'none', text: '两年制大专目前没有德国高校入学资格' };
      case 'zhongzhi':
        return { route: 'none', text: 'APS 的入学规则里没有中职这条路，具体请问 APS' };
      case 'intl':
        return { route: 'none', text: '国际课程（A-Level、IB 等）德国另有算法，本工具暂不判断' };
    }
    return { route: 'none', text: '' };
  };

  // ---------- 学段不合适时的说明 ----------
  var STAGE_REASON = {
    k12: '只收 9 年级及以上的中学生',
    foundation: '给高中毕业（参加过高考）或三年制专科毕业的学生读',
    vocational: '一般高中阶段以后才去',
    bachelor: '这个学历背景暂时走不通本科',
    master: '要先有本科学位',
    phd: '要先有硕士学位'
  };

  var ROUTE_SCORE = { direct: 4, foundation: 3, conditional: 2, hard: 1 };
  var LANG_SCORE = { has: 3, learn: 1 };

  function goalScore(country, prog, p) {
    var s = 0, hits = [];
    (p.goals || []).forEach(function (g, i) {
      var fit = (country.goal_fit || {})[g];
      var w = GOAL_WEIGHT[i] || 1;
      var boost = (prog.match.goal_boost || []).indexOf(g) >= 0 ? 1 : 0;
      if (fit) {
        s += (fit.score + boost) * w / 3;
        if (fit.score + boost >= 2 && fit.why_zh) hits.push(fit.why_zh);
      }
    });
    return { score: Math.min(s, 4), hits: hits };
  }

  // ---------- 主函数：给一个国家的每类项目打分 ----------
  function evaluate(country, p) {
    var out = { picks: [], skipped: [] };
    var budgetMax = BUDGET_MAX[p.budget];
    country.programs.forEach(function (prog) {
      var m = prog.match || {};
      if (m.is_step || m.never) return;

      if (m.stages && m.stages.indexOf(p.stage) < 0) {
        out.skipped.push({ prog: prog, kind: 'stage', why: STAGE_REASON[prog.type] || '学历阶段不合适' });
        return;
      }
      if (m.max_age && p.age && p.age > m.max_age) { out.skipped.push({ prog: prog, why: '年龄超过 ' + m.max_age + ' 岁' }); return; }
      if (m.min_age && p.age && p.age < m.min_age) { out.skipped.push({ prog: prog, why: '一般 ' + m.min_age + ' 岁以上才去' }); return; }

      var reasons = [], notes = [];
      var acc = { route: 'direct', text: '' };
      if (m.access && ACCESS[m.access]) acc = ACCESS[m.access](p);
      if (acc.route === 'none') { out.skipped.push({ prog: prog, why: acc.text || '入学条件不符合' }); return; }
      if (acc.text) reasons.push(acc.text);

      var lc = langCheck(m.lang, p);
      if (lc.st === 'no') { out.skipped.push({ prog: prog, why: lc.text }); return; }
      if (lc.text) reasons.push(lc.text);

      var bScore = 2;
      if (m.min_budget != null && budgetMax != null) {
        if (budgetMax < m.min_budget) {
          out.skipped.push({ prog: prog, why: '每年预算低于学生签证要求的资金证明（约 ' + m.min_budget + ' 万元）' });
          return;
        }
        if (budgetMax < m.min_budget + TIGHT_MARGIN) { bScore = 1; notes.push('预算比较紧，最好选免学费的州'); }
      }

      if (prog.type === 'k12') {
        if (p.stage === 'junior') notes.push('要读到 9 年级才能申请');
        if (p.parent === 'yes') notes.push('德国没有家长陪读签证，孩子要住寄宿学校');
      }
      if (prog.type === 'bachelor' && p.field === 'med' && acc.route === 'direct' && p.gaokaoPct != null && p.gaokaoPct < 80)
        notes.push('想读医学、药学、牙医或法律，高考要 80% 以上');

      var g = goalScore(country, prog, p);
      if (p.field === 'skill' && prog.type === 'vocational') g.score += 1;

      var total = (ROUTE_SCORE[acc.route] || 1) + (LANG_SCORE[lc.st] || 1) + bScore + g.score;
      var tier = total >= TIER_GOOD ? 1 : total >= TIER_OK ? 2 : 3;
      if (prog.type === 'k12' && tier < 2) tier = 2;
      if (acc.route === 'hard') tier = 3;
      // 已有本科或硕士学位、又没选“学门技术尽快工作”的，职业培训最多放在“可以考虑”
      if (prog.type === 'vocational' && (p.stage === 'bachelor_done' || p.stage === 'master_done') &&
          (p.goals || []).indexOf('skill_job') < 0 && p.field !== 'skill' && tier < 2) tier = 2;

      out.picks.push({ country: country, prog: prog, tier: tier, score: total, route: acc.route, lang: lc,
        reasons: reasons, notes: notes, goals: g.hits });
    });
    return out;
  }

  window.MatchRules = { evaluate: evaluate, BUDGET_MAX: BUDGET_MAX };
})();
