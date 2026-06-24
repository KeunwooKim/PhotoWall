export interface WallContextMenuItem {
  id: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
}

export interface WallContextMenuSection {
  title?: string;
  items: WallContextMenuItem[];
}

export interface WallContextMenuActions {
  onCopy: () => void;
  onCut: () => void;
  onPaste: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onAlignLeft: () => void;
  onAlignCenterH: () => void;
  onAlignRight: () => void;
  onAlignTop: () => void;
  onAlignMiddle: () => void;
  onAlignBottom: () => void;
  onCenterOnWall: () => void;
  onDistributeHorizontal: () => void;
  onDistributeVertical: () => void;
  onFlipHorizontal: () => void;
  onFlipVertical: () => void;
  onGroup: () => void;
  onUngroup: () => void;
  onBringToFront: () => void;
  onBringForward: () => void;
  onSendBackward: () => void;
  onSendToBack: () => void;
}

interface BuildSectionsOptions {
  selectionCount: number;
  canAlign: boolean;
  canDistribute: boolean;
  canGroup: boolean;
  canUngroup: boolean;
  actions: WallContextMenuActions;
  onClose: () => void;
}

function wrap(onClose: () => void, action: () => void) {
  return () => {
    action();
    onClose();
  };
}

export function buildWallContextMenuSections({
  selectionCount,
  canAlign,
  canDistribute,
  canGroup,
  canUngroup,
  actions,
  onClose,
}: BuildSectionsOptions): WallContextMenuSection[] {
  if (selectionCount === 0) return [];

  const w = (fn: () => void) => wrap(onClose, fn);

  const groupItems: WallContextMenuItem[] = [];
  if (canUngroup) {
    groupItems.push({
      id: "ungroup",
      label: "그룹 해제",
      onClick: w(actions.onUngroup),
    });
  } else if (canGroup) {
    groupItems.push({
      id: "group",
      label: "그룹하기",
      onClick: w(actions.onGroup),
    });
  }

  const sections: WallContextMenuSection[] = [
    {
      title: "클립보드",
      items: [
        { id: "copy", label: "복사", onClick: w(actions.onCopy) },
        { id: "cut", label: "잘라내기", onClick: w(actions.onCut) },
        { id: "paste", label: "붙여넣기", onClick: w(actions.onPaste) },
        { id: "duplicate", label: "복제", onClick: w(actions.onDuplicate) },
        {
          id: "delete",
          label: "삭제",
          onClick: w(actions.onDelete),
          destructive: true,
        },
      ],
    },
  ];

  if (groupItems.length > 0) {
    sections.push({ title: "그룹", items: groupItems });
  }

  sections.push(
    {
      title: "정렬",
      items: [
        {
          id: "align-left",
          label: "왼쪽 맞춤",
          onClick: w(actions.onAlignLeft),
          disabled: !canAlign,
        },
        {
          id: "align-center-h",
          label: "가로 가운데",
          onClick: w(actions.onAlignCenterH),
          disabled: !canAlign,
        },
        {
          id: "align-right",
          label: "오른쪽 맞춤",
          onClick: w(actions.onAlignRight),
          disabled: !canAlign,
        },
        {
          id: "align-top",
          label: "위 맞춤",
          onClick: w(actions.onAlignTop),
          disabled: !canAlign,
        },
        {
          id: "align-middle",
          label: "세로 가운데",
          onClick: w(actions.onAlignMiddle),
          disabled: !canAlign,
        },
        {
          id: "align-bottom",
          label: "아래 맞춤",
          onClick: w(actions.onAlignBottom),
          disabled: !canAlign,
        },
        { id: "center-wall", label: "벽 가운데", onClick: w(actions.onCenterOnWall) },
        {
          id: "distribute-h",
          label: "가로 균등 배치",
          onClick: w(actions.onDistributeHorizontal),
          disabled: !canDistribute,
        },
        {
          id: "distribute-v",
          label: "세로 균등 배치",
          onClick: w(actions.onDistributeVertical),
          disabled: !canDistribute,
        },
      ],
    },
    {
      title: "변형",
      items: [
        { id: "flip-h", label: "좌우 뒤집기", onClick: w(actions.onFlipHorizontal) },
        { id: "flip-v", label: "상하 뒤집기", onClick: w(actions.onFlipVertical) },
      ],
    },
    {
      title: "레이어",
      items: [
        { id: "front", label: "맨 앞으로", onClick: w(actions.onBringToFront) },
        { id: "forward", label: "앞으로", onClick: w(actions.onBringForward) },
        { id: "backward", label: "뒤로", onClick: w(actions.onSendBackward) },
        { id: "back", label: "맨 뒤로", onClick: w(actions.onSendToBack) },
      ],
    },
  );

  return sections;
}
