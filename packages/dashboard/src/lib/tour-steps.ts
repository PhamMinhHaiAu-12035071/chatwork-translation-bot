import type { Step } from 'nextstepjs'

export const TOUR_VERSION = 1
export const TOUR_NAME = 'main-tour' as const

export type NeubStep = Step & { color: string }

const steps: NeubStep[] = [
  {
    icon: null,
    title: '👋 Chào mừng!',
    content:
      'Đây là nơi để xem và quản lý các phòng dịch. Mình sẽ chỉ bạn từng phần, ngắn gọn và dễ làm theo.',
    side: 'bottom',
    showControls: true,
    showSkip: true,
    color: '#ffd166',
  },
  {
    icon: null,
    selector: '#tour-sidebar-nav',
    title: '🧭 Thanh menu',
    content:
      'Cột này là menu chính. Dashboard để xem tổng quan, New Room để tạo phòng mới, Free Rooms để xem phòng miễn phí, New Free Room để tạo phòng miễn phí, Webhook Guide để xem cách nối Chatwork.',
    side: 'right',
    showControls: true,
    showSkip: true,
    color: '#7a9e9f',
  },
  {
    icon: null,
    selector: '#tour-stat-total',
    title: '📦 Tổng số phòng',
    content: 'Con số này cho biết bạn đang có tất cả bao nhiêu phòng đã được tạo.',
    side: 'bottom',
    showControls: true,
    showSkip: true,
    color: '#c9b1ff',
  },
  {
    icon: null,
    selector: '#tour-stat-active',
    title: '✅ Phòng đang bật',
    content: 'Đây là số phòng đang hoạt động. Khi phòng đang bật, bot đang làm việc.',
    side: 'bottom',
    showControls: true,
    showSkip: true,
    color: '#86e8c0',
  },
  {
    icon: null,
    selector: '#tour-stat-inactive',
    title: '⏸️ Phòng đang tạm dừng',
    content: 'Đây là số phòng đang nghỉ tạm. Muốn dùng lại thì chỉ cần bật lên.',
    side: 'bottom',
    showControls: true,
    showSkip: true,
    color: '#fed7aa',
  },
  {
    icon: null,
    selector: '#tour-new-room',
    title: '➕ Tạo phòng mới',
    content: 'Bấm nút này để mở trang tạo phòng mới. Mình sẽ đi cùng bạn từng ô một.',
    side: 'bottom',
    showControls: true,
    showSkip: true,
    nextRoute: '/rooms/new',
    color: '#90cdf4',
  },
  {
    icon: null,
    selector: '#tour-field-roomid',
    title: '🔢 Room ID',
    content:
      'Điền số ID của room Chatwork cần dịch. Trong link của room, nhìn phần nằm sau chữ rid.',
    side: 'right',
    showControls: true,
    showSkip: true,
    prevRoute: '/',
    color: '#ffc8a0',
  },
  {
    icon: null,
    selector: '#tour-field-roomname-orig',
    title: '🏢 Original Room Name',
    content:
      'Tên gốc của room từ Chatwork. Bot sẽ tự động lấy tên này từ API của Chatwork sau khi bạn nhập Room ID.',
    side: 'right',
    showControls: true,
    showSkip: true,
    color: '#b8e6e6',
  },
  {
    icon: null,
    selector: '#tour-field-roomname',
    title: '🏷️ Tên phòng',
    content: 'Đặt một cái tên dễ nhớ cho phòng này. Ví dụ: Nhom Ky Thuat JP hoặc Bao Cao Sang.',
    side: 'right',
    showControls: true,
    showSkip: true,
    color: '#f4978e',
  },
  {
    icon: null,
    selector: '#tour-field-provider',
    title: '🤖 Hãng AI',
    content: 'Chọn hãng AI sẽ giúp bạn dịch, ví dụ OpenAI hoặc Gemini.',
    side: 'right',
    showControls: true,
    showSkip: true,
    color: '#ffb3c1',
  },
  {
    icon: null,
    selector: '#tour-field-model',
    title: '🧠 Model AI',
    content: 'Chọn model AI. Bạn có thể hiểu đơn giản đây là phiên bản AI mà bot sẽ dùng.',
    side: 'right',
    showControls: true,
    showSkip: true,
    color: '#9381ff',
  },
  {
    icon: null,
    selector: '#tour-field-style',
    title: '🎨 Kiểu dịch',
    content: 'Chọn kiểu lời văn bạn muốn bot dùng, như thân thiện, lịch sự, hoặc kỹ thuật.',
    side: 'right',
    showControls: true,
    showSkip: true,
    color: '#bef264',
  },
  {
    icon: null,
    selector: '#tour-field-token',
    title: '🔑 API Token',
    content: 'Dán chìa khóa API của hãng AI vào đây. Thiếu ô này thì bot sẽ không làm việc được.',
    side: 'right',
    showControls: true,
    showSkip: true,
    color: '#e4c1f9',
  },
  {
    icon: null,
    selector: '#tour-field-context',
    title: '📝 Translation Context',
    content:
      'Nếu cần, mở phần này và viết vài câu để nói room này đang nói về chủ đề gì. AI sẽ hiểu bài hơn.',
    side: 'top',
    showControls: true,
    showSkip: true,
    color: '#a8d8a8',
  },
  {
    icon: null,
    selector: '#tour-context-templates',
    title: '⚡ Mẫu điền nhanh',
    content:
      'Nếu chưa biết viết gì, bạn có thể bấm một mẫu có sẵn để điền nhanh, rồi sửa lại cho hợp ý mình.',
    side: 'left',
    showControls: true,
    showSkip: true,
    color: '#d1fae5',
  },
  {
    icon: null,
    selector: '#tour-field-keywords',
    title: '🛡️ Keyword Protection',
    content:
      'Nếu có tên riêng không muốn bị dịch, mở phần này để giữ nguyên những từ quan trọng đó.',
    side: 'top',
    showControls: true,
    showSkip: true,
    color: '#fcd34d',
  },
  {
    icon: null,
    selector: '#tour-keyword-addform',
    title: '➕ Thêm keyword',
    content:
      'Nhập từ cần giữ nguyên, chọn loại của nó, nếu muốn thì đặt tên thay thế, rồi bấm Add.',
    side: 'bottom',
    showControls: true,
    showSkip: true,
    color: '#fef3c7',
  },
  {
    icon: null,
    selector: '#tour-save-btn',
    title: '💾 Lưu phòng',
    content: 'Khi đã kiểm tra xong, bấm Create Room để lưu. Sau đó bạn sẽ quay về dashboard.',
    side: 'top',
    showControls: true,
    showSkip: true,
    nextRoute: '/',
    color: '#fb923c',
  },
  {
    icon: null,
    selector: '#tour-room-card-first',
    title: '🃏 Thẻ phòng',
    content: 'Mỗi thẻ là một phòng bạn đã tạo. Trong thẻ có các thông tin chính của phòng đó.',
    side: 'right',
    showControls: true,
    showSkip: true,
    prevRoute: '/rooms/new',
    color: '#fde68a',
  },
  {
    icon: null,
    selector: '#tour-status-toggle',
    title: '🔀 Bật / Tắt',
    content: 'Nút này dùng để bật hoặc tắt bot của phòng. Bật là bot làm việc, tắt là bot nghỉ.',
    side: 'left',
    showControls: true,
    showSkip: true,
    color: '#a5f3fc',
  },
  {
    icon: null,
    selector: '#tour-edit-btn',
    title: '✏️ Sửa phòng',
    content:
      'Muốn sửa thông tin thì bấm Edit. Màn hình sửa gần giống lúc tạo nên bạn chỉ cần đổi chỗ cần đổi.',
    side: 'top',
    showControls: true,
    showSkip: true,
    color: '#99f6e4',
  },
  {
    icon: null,
    selector: '#tour-delete-btn',
    title: '🗑️ Xóa phòng',
    content: 'Muốn xóa phòng thì bấm Delete. Hệ thống sẽ hỏi lại một lần nữa để tránh bấm nhầm.',
    side: 'top',
    showControls: true,
    showSkip: true,
    color: '#f9a8d4',
  },
  {
    icon: null,
    title: '🎉 Xong rồi!',
    content: 'Bạn đã xem xong tour. Khi nào cần xem lại, chỉ cần bấm nút dấu hỏi ở góc màn hình.',
    side: 'bottom',
    showControls: true,
    showSkip: false,
    color: '#ff6b6b',
  },
]

// Helper to strip navigation properties from a step
function cleanStep(step: NeubStep | undefined): NeubStep {
  if (!step) throw new Error('Step is undefined')
  const stepCopy = Object.assign({}, step)
  delete (stepCopy as unknown as Record<string, unknown>)['nextRoute']
  delete (stepCopy as unknown as Record<string, unknown>)['prevRoute']
  return stepCopy
}

// Replay tours: route-scoped step sets without cross-page navigation
const dashboardEmptyReplaySteps: NeubStep[] = [
  cleanStep(steps[0]), // Welcome
  cleanStep(steps[1]), // Sidebar nav
  cleanStep(steps[2]), // Stat total
  cleanStep(steps[3]), // Stat active
  cleanStep(steps[4]), // Stat inactive
  cleanStep(steps[22]), // Completion
]

const dashboardWithRoomReplaySteps: NeubStep[] = [
  cleanStep(steps[0]), // Welcome
  cleanStep(steps[1]), // Sidebar nav
  cleanStep(steps[2]), // Stat total
  cleanStep(steps[3]), // Stat active
  cleanStep(steps[4]), // Stat inactive
  cleanStep(steps[18]), // Room card first
  cleanStep(steps[19]), // Status toggle
  cleanStep(steps[20]), // Edit btn
  cleanStep(steps[21]), // Delete btn
  cleanStep(steps[22]), // Completion
]

const createRoomReplaySteps: NeubStep[] = [
  cleanStep(steps[0]), // Welcome (only at top of create form)
  cleanStep(steps[6]), // Room ID field
  cleanStep(steps[7]), // Room name orig
  cleanStep(steps[8]), // Room name
  cleanStep(steps[9]), // Provider
  cleanStep(steps[10]), // Model
  cleanStep(steps[11]), // Style
  cleanStep(steps[12]), // Token
  cleanStep(steps[13]), // Context
  cleanStep(steps[14]), // Context templates
  cleanStep(steps[15]), // Keywords
  cleanStep(steps[16]), // Keyword add form
  cleanStep(steps[22]), // Completion
]

const editRoomReplaySteps = createRoomReplaySteps

export const DASHBOARD_EMPTY_REPLAY_TOUR = 'dashboard-empty-tour' as const
export const DASHBOARD_WITH_ROOM_REPLAY_TOUR = 'dashboard-with-room-tour' as const
export const CREATE_ROOM_REPLAY_TOUR = 'create-room-tour' as const
export const EDIT_ROOM_REPLAY_TOUR = 'edit-room-tour' as const

type ReplayTourName =
  | typeof DASHBOARD_EMPTY_REPLAY_TOUR
  | typeof DASHBOARD_WITH_ROOM_REPLAY_TOUR
  | typeof CREATE_ROOM_REPLAY_TOUR
  | typeof EDIT_ROOM_REPLAY_TOUR

export interface ReplayTour {
  tour: ReplayTourName
  steps: NeubStep[]
}

export function getReplayTourForRoute(pathname: string, hasRooms: boolean): ReplayTour | null {
  if (pathname === '/') {
    return hasRooms
      ? { tour: DASHBOARD_WITH_ROOM_REPLAY_TOUR, steps: dashboardWithRoomReplaySteps }
      : { tour: DASHBOARD_EMPTY_REPLAY_TOUR, steps: dashboardEmptyReplaySteps }
  }

  if (pathname === '/rooms/new') {
    return { tour: CREATE_ROOM_REPLAY_TOUR, steps: createRoomReplaySteps }
  }

  if (pathname.startsWith('/rooms/') && pathname !== '/rooms/new') {
    return { tour: EDIT_ROOM_REPLAY_TOUR, steps: editRoomReplaySteps }
  }

  return null
}

const replayTours: ReplayTour[] = [
  { tour: DASHBOARD_EMPTY_REPLAY_TOUR, steps: dashboardEmptyReplaySteps },
  { tour: DASHBOARD_WITH_ROOM_REPLAY_TOUR, steps: dashboardWithRoomReplaySteps },
  { tour: CREATE_ROOM_REPLAY_TOUR, steps: createRoomReplaySteps },
  { tour: EDIT_ROOM_REPLAY_TOUR, steps: editRoomReplaySteps },
]

export const tours: { tour: string; steps: NeubStep[] }[] = [
  { tour: TOUR_NAME, steps },
  ...replayTours,
]
