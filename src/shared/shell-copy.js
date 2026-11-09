// Text the shell needs before (or without) data/tutorial.json: loading and error
// states, the update notice and the unsaved-answers dialog. Tests keep these equal
// to the matching ui strings in the data file.
export const SHELL=Object.freeze({
  loading:'주문표를 펼치는 중…',
  loadError:'내용을 불러오지 못했어요. 다시 시도해 주세요.',
  loadTimeout:'불러오는 시간이 길어지고 있어요. 다시 시도해 주세요.',
  retry:'다시 시도',
  startError:'튜토리얼을 시작하지 못했어요. 일반 새로고침 후 다시 시도해 주세요.',
  navError:'화면을 이동하지 못했어요.',
  updateBanner:'새 버전이 준비되어 있어요. 작성 중인 답은 지키고, 다음 화면 이동 때 자동으로 적용해요.',
  guard:Object.freeze({
    description:'고른 답과 메모를 임시 저장한 뒤 이동할 수 있어요.',
    descriptionUpdate:'새 버전이 준비되어 있어요. 답을 저장한 뒤 이동하면 새 버전에서 이어서 풀 수 있어요.',
    saveError:'저장하지 못했어요. 답은 그대로 있어요. 다시 시도하거나 계속 풀기를 눌러 주세요.'
  }),
  historyRestoreError:'화면 이동을 되돌리지 못했어요. 작성 중인 답을 먼저 저장해 주세요.',
  theme:Object.freeze({prefix:'테마',auto:'자동',light:'밝게',dark:'어둡게'}),
  motion:'움직임 줄이기'
});
