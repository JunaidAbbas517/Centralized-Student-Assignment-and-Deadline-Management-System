type Row = Record<string, unknown>

/** Local date `offset` days from today at hh:mm, as an ISO string. */
const dayAt = (offset: number, h = 23, m = 59) => {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  d.setHours(h, m, 0, 0)
  return d.toISOString()
}

/** Column defaults from schema.sql for an assignment's submission rules. */
export const ASSIGNMENT_DEFAULTS: Row = {
  total_marks: 100, submission_type: 'file', allowed_extensions: ['pdf', 'zip'], max_file_mb: 20, max_files: 5,
  summary_required: false, allow_late: true,
}

/** The demo student's handed-in work: [assignment, days before the deadline, returned marks or null, late]. */
const HANDED_IN: [string, number, number | null, boolean][] = [
  ['m1', 1, 92, false], ['m2', 2, 78, false], ['m3', 1, 86, false],
  ['s1', 0, 88, false], ['s2', -1, 70, true], ['s3', 1, null, false], ['s4', 2, null, false],
  ['i1', 3, 95, false],
]

/** Sample data for demo mode (design preview). */
export function seed(): Record<string, Row[]> {
  const a = (id: string, course: string, title: string, deadline: string, description = '', created = dayAt(-40, 9, 5)): Row => ({
    id, course_id: course, title, description, current_deadline: deadline, created_at: created,
    ...ASSIGNMENT_DEFAULTS,
  })
  const assignments: Row[] = [
    // Machine Learning (7)
    a('m1', 'c1', 'Lab 1: Linear regression', dayAt(-35)),
    a('m2', 'c1', 'Lab 2: Logistic regression', dayAt(-25)),
    a('m3', 'c1', 'Quiz 3: Neural networks', dayAt(-14)),
    a('m4', 'c1', 'Lab 3: Convolutional networks', dayAt(-1), 'Train a small CNN on CIFAR-10 and report accuracy and loss curves.'),
    a('m5', 'c1', 'Quiz 4: Optimization', dayAt(3, 10, 0), 'Gradient descent variants, momentum, and Adam.'),
    a('m6', 'c1', 'Project proposal', dayAt(17), 'One-page proposal with dataset and evaluation plan.'),
    a('m7', 'c1', 'Lab 4: RNNs', dayAt(24)),
    // Intelligent Software Engineering (6)
    a('s1', 'c2', 'Project charter', dayAt(-33)),
    a('s2', 'c2', 'Use case diagrams', dayAt(-26)),
    a('s3', 'c2', 'Sprint 1 demo', dayAt(-18)),
    a('s4', 'c2', 'Reading summary', dayAt(-9)),
    a('s5', 'c2', 'Requirements specification', dayAt(2), 'Write an SRS for your project, including use cases and functional requirements.'),
    a('s6', 'c2', 'Sprint 2 demo slides', dayAt(15, 14, 0)),
    // Medical Image Analysis (4)
    a('i1', 'c3', 'Reading summary: U-Net', dayAt(-30)),
    a('i2', 'c3', 'Dataset exploration', dayAt(-12)),
    a('i3', 'c3', 'Segmentation Report', dayAt(13), 'Train a segmentation model on the course dataset and submit a written report of the method and results.'),
    a('i4', 'c3', 'Paper review', dayAt(21)),
  ]
  return {
    profiles: [
      { id: 'u-admin', full_name: 'Site Admin', email: 'admin@demo.edu', role: 'admin', status: 'active', created_at: dayAt(-40, 10, 0) },
      { id: 'u-inst', full_name: 'Dr. Wang Lin', email: 'instructor@demo.edu', role: 'instructor', status: 'active', created_at: dayAt(-30, 10, 0) },
      { id: 'u-inst2', full_name: 'Prof. Sara Malik', email: 'sara@demo.edu', role: 'instructor', status: 'pending', created_at: dayAt(-1, 10, 0) },
      { id: 'u-inst3', full_name: 'Li Hua', email: 'lihua@demo.edu', role: 'instructor', status: 'pending', created_at: dayAt(-3, 10, 0) },
      { id: 'u-stu', full_name: 'Alex Chen', email: 'student@demo.edu', role: 'student', status: 'active', created_at: dayAt(-28, 10, 0) },
      { id: 'u-stu2', full_name: 'Chen Mei', email: 'chen@demo.edu', role: 'student', status: 'active', created_at: dayAt(-5, 10, 0) },
    ],
    courses: [
      { id: 'c1', instructor_id: 'u-inst', name: 'Machine Learning', course_code: 'CS510', enrollment_code: 'ML510ABC', archived: false, created_at: dayAt(-60) },
      { id: 'c2', instructor_id: 'u-inst', name: 'Intelligent Software Engineering', course_code: 'CS520', enrollment_code: 'ISE520XY', archived: false, created_at: dayAt(-59) },
      { id: 'c3', instructor_id: 'u-inst', name: 'Medical Image Analysis', course_code: 'CS530', enrollment_code: 'MIA530QR', archived: false, created_at: dayAt(-58) },
    ],
    enrollments: [
      { id: 'e1', student_id: 'u-stu', course_id: 'c1' },
      { id: 'e2', student_id: 'u-stu', course_id: 'c2' },
      { id: 'e3', student_id: 'u-stu', course_id: 'c3' },
      { id: 'e4', student_id: 'u-stu2', course_id: 'c1' },
    ],
    assignments,
    deadline_changes: [
      {
        id: 'd1', assignment_id: 'i3', previous_deadline: dayAt(9), new_deadline: dayAt(13), changed_by: 'u-inst',
        reason: 'Extended because access to the dataset was delayed.', changed_at: dayAt(0, 15, 40),
      },
    ],
    assignment_progress: [
      ...HANDED_IN.map(([id]) => ({ id: `p-${id}`, student_id: 'u-stu', assignment_id: id, status: 'completed' })),
      { id: 'p-s5', student_id: 'u-stu', assignment_id: 's5', status: 'in_progress' },
      { id: 'p-m6', student_id: 'u-stu', assignment_id: 'm6', status: 'in_progress' },
    ],
    notifications: [
      { id: 'n1', recipient_id: 'u-stu', assignment_id: 'i3', deadline_change_id: 'd1', type: 'deadline_changed', message: 'Deadline changed: Segmentation Report', is_read: false, created_at: dayAt(0, 15, 40) },
      { id: 'n2', recipient_id: 'u-stu', assignment_id: 's5', deadline_change_id: null, type: 'reminder', message: 'Reminder: Requirements specification due in 2 days', is_read: false, created_at: dayAt(0, 9, 0) },
      { id: 'n3', recipient_id: 'u-stu', assignment_id: 'm5', deadline_change_id: null, type: 'new_assignment', message: 'New assignment published: Quiz 4', is_read: true, created_at: dayAt(-1, 10, 0) },
      { id: 'n4', recipient_id: 'u-stu', assignment_id: 'm3', deadline_change_id: null, type: 'graded', message: 'Graded: Quiz 3: Neural networks (86/100)', is_read: true, created_at: dayAt(-10, 11, 0) },
    ],
    assignment_files: [],
    submissions: HANDED_IN.map(([id, daysBefore, , late]) => {
      const due = new Date(String(assignments.find((x) => x.id === id)?.current_deadline))
      due.setDate(due.getDate() - daysBefore)
      return {
        id: `sub-${id}`, assignment_id: id, student_id: 'u-stu', attempt: 1, link: null, is_late: late,
        summary: id === 'm3' ? 'Answers to all five questions, with derivations for Q3.' : '', submitted_at: due.toISOString(),
      }
    }),
    submission_files: [],
    grades: HANDED_IN.filter(([, , marks]) => marks !== null).map(([id, , marks]) => ({
      id: `g-${id}`, assignment_id: id, student_id: 'u-stu', submission_id: `sub-${id}`, marks,
      feedback: id === 'm3' ? 'Clear derivations. Revisit the vanishing-gradient question.' : 'Good work.',
      graded_by: 'u-inst', graded_at: dayAt(-10, 11, 0), returned_at: dayAt(-10, 11, 0),
    })),
  }
}
