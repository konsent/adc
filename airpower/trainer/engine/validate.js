import { RULES } from '../rules/index.js?v=power-response-2';

/**
 * 활성 규칙을 순회하며 위반을 모은다.
 * 이 함수 하나가 힌트 모드(매 클릭)와 턴 종료 채점 양쪽에 쓰인다.
 *
 * @param {object} state 현재 상태
 * @param {object} action 검사할 행동
 * @param {{activeRules: string[]|null, lesson: number}} options
 * @returns {Array<{rule,severity,msg,fix,ref}>}
 */
export function validate(state, action, options = {}) {
  const { activeRules = null, lesson = 4 } = options;
  const out = [];

  for (const rule of RULES) {
    if (rule.lesson > lesson) continue;
    if (activeRules !== null && !activeRules.includes(rule.id)) continue;

    const found = rule.check(state, action);
    if (found && found.length) out.push(...found);
  }
  return out;
}
