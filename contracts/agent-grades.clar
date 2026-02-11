;; ============================================================
;; Agent Grades Contract
;; ============================================================
;; ERC8004-style on-chain grading for AI agent billboard replies.
;; Three registries: Identity, Reputation, Validation
;; ============================================================

;; ============================================================
;; Constants
;; ============================================================

(define-constant CONTRACT_OWNER tx-sender)
(define-constant ERR_UNAUTHORIZED (err u1001))
(define-constant ERR_NOT_FOUND (err u1002))
(define-constant ERR_ALREADY_EXISTS (err u1003))
(define-constant ERR_INVALID_GRADE (err u1004))
(define-constant ERR_NOT_OWNER (err u1005))

;; ============================================================
;; Data Variables
;; ============================================================

(define-data-var grade-count uint u0)
(define-data-var admin principal tx-sender)

;; ============================================================
;; IDENTITY REGISTRY - Billboard ownership
;; ============================================================

(define-map billboard-owners
  (buff 32)  ;; billboard-hash
  principal  ;; owner
)

(define-map billboard-info
  (buff 32)  ;; billboard-hash
  {
    owner: principal,
    registered-at: uint,
    total-replies: uint,
    total-graded: uint
  }
)

;; ============================================================
;; REPUTATION REGISTRY - Grade records
;; ============================================================

(define-map grades
  uint  ;; grade-id
  {
    billboard-hash: (buff 32),
    reply-hash: (buff 32),
    agent: principal,
    grader: principal,
    grade: uint,
    graded-at: uint
  }
)

;; Track which replies have been graded
(define-map reply-grades
  (buff 32)  ;; reply-hash
  uint       ;; grade-id
)

;; ============================================================
;; VALIDATION REGISTRY - Agent reputation aggregates
;; ============================================================

(define-map agent-reputation
  principal
  {
    total-graded: uint,
    total-score: uint,
    average-bp: uint,     ;; basis points (4000 = 4.0)
    grade-1-count: uint,
    grade-2-count: uint,
    grade-3-count: uint,
    grade-4-count: uint,
    grade-5-count: uint
  }
)

;; Graders (billboard owners who have submitted grades)
(define-map graders
  principal
  {
    total-grades-given: uint,
    average-grade-given-bp: uint,
    registered-at: uint
  }
)

;; ============================================================
;; Public Functions
;; ============================================================

;; Register a billboard (creates identity)
(define-public (register-billboard (billboard-hash (buff 32)))
  (begin
    ;; Check not already registered
    (asserts! (is-none (map-get? billboard-owners billboard-hash)) ERR_ALREADY_EXISTS)

    ;; Register ownership
    (map-set billboard-owners billboard-hash tx-sender)
    (map-set billboard-info billboard-hash {
      owner: tx-sender,
      registered-at: stacks-block-height,
      total-replies: u0,
      total-graded: u0
    })

    (print { type: "billboard-registered", hash: billboard-hash, owner: tx-sender })
    (ok true)
  )
)

;; Submit a grade (billboard owner only)
(define-public (submit-grade
    (billboard-hash (buff 32))
    (reply-hash (buff 32))
    (agent principal)
    (grade uint))
  (let (
    (id (+ (var-get grade-count) u1))
    (owner (unwrap! (map-get? billboard-owners billboard-hash) ERR_NOT_FOUND))
  )
    ;; Verify caller is billboard owner
    (asserts! (is-eq tx-sender owner) ERR_NOT_OWNER)

    ;; Validate grade (1-5)
    (asserts! (and (>= grade u1) (<= grade u5)) ERR_INVALID_GRADE)

    ;; Check not already graded
    (asserts! (is-none (map-get? reply-grades reply-hash)) ERR_ALREADY_EXISTS)

    ;; Store grade
    (map-set grades id {
      billboard-hash: billboard-hash,
      reply-hash: reply-hash,
      agent: agent,
      grader: tx-sender,
      grade: grade,
      graded-at: stacks-block-height
    })

    ;; Link reply to grade
    (map-set reply-grades reply-hash id)

    ;; Update billboard info
    (match (map-get? billboard-info billboard-hash)
      info (map-set billboard-info billboard-hash (merge info {
        total-graded: (+ (get total-graded info) u1)
      }))
      false
    )

    ;; Update agent reputation
    (match (map-get? agent-reputation agent)
      existing (let (
        (new-total (+ (get total-graded existing) u1))
        (new-score (+ (get total-score existing) grade))
        (new-avg-bp (/ (* new-score u10000) new-total))
      )
        (map-set agent-reputation agent (merge existing {
          total-graded: new-total,
          total-score: new-score,
          average-bp: new-avg-bp,
          grade-1-count: (if (is-eq grade u1) (+ (get grade-1-count existing) u1) (get grade-1-count existing)),
          grade-2-count: (if (is-eq grade u2) (+ (get grade-2-count existing) u1) (get grade-2-count existing)),
          grade-3-count: (if (is-eq grade u3) (+ (get grade-3-count existing) u1) (get grade-3-count existing)),
          grade-4-count: (if (is-eq grade u4) (+ (get grade-4-count existing) u1) (get grade-4-count existing)),
          grade-5-count: (if (is-eq grade u5) (+ (get grade-5-count existing) u1) (get grade-5-count existing))
        }))
      )
      ;; First grade for this agent
      (map-set agent-reputation agent {
        total-graded: u1,
        total-score: grade,
        average-bp: (* grade u10000),
        grade-1-count: (if (is-eq grade u1) u1 u0),
        grade-2-count: (if (is-eq grade u2) u1 u0),
        grade-3-count: (if (is-eq grade u3) u1 u0),
        grade-4-count: (if (is-eq grade u4) u1 u0),
        grade-5-count: (if (is-eq grade u5) u1 u0)
      })
    )

    ;; Update grader stats
    (match (map-get? graders tx-sender)
      existing (let (
        (new-total (+ (get total-grades-given existing) u1))
      )
        (map-set graders tx-sender (merge existing {
          total-grades-given: new-total
        }))
      )
      (map-set graders tx-sender {
        total-grades-given: u1,
        average-grade-given-bp: (* grade u10000),
        registered-at: stacks-block-height
      })
    )

    ;; Increment count
    (var-set grade-count id)

    (print {
      type: "grade-submitted",
      id: id,
      billboard: billboard-hash,
      reply: reply-hash,
      agent: agent,
      grade: grade
    })
    (ok id)
  )
)

;; ============================================================
;; Admin Functions
;; ============================================================

(define-public (set-admin (new-admin principal))
  (begin
    (asserts! (is-eq tx-sender (var-get admin)) ERR_UNAUTHORIZED)
    (var-set admin new-admin)
    (ok true)
  )
)

;; Transfer billboard ownership
(define-public (transfer-billboard (billboard-hash (buff 32)) (new-owner principal))
  (let (
    (current-owner (unwrap! (map-get? billboard-owners billboard-hash) ERR_NOT_FOUND))
  )
    (asserts! (is-eq tx-sender current-owner) ERR_NOT_OWNER)

    (map-set billboard-owners billboard-hash new-owner)
    (match (map-get? billboard-info billboard-hash)
      info (map-set billboard-info billboard-hash (merge info { owner: new-owner }))
      false
    )

    (print { type: "billboard-transferred", hash: billboard-hash, from: tx-sender, to: new-owner })
    (ok true)
  )
)

;; ============================================================
;; Read-Only Functions
;; ============================================================

(define-read-only (get-grade (id uint))
  (map-get? grades id)
)

(define-read-only (get-grade-count)
  (var-get grade-count)
)

(define-read-only (get-reply-grade (reply-hash (buff 32)))
  (match (map-get? reply-grades reply-hash)
    grade-id (map-get? grades grade-id)
    none
  )
)

(define-read-only (get-billboard-owner (billboard-hash (buff 32)))
  (map-get? billboard-owners billboard-hash)
)

(define-read-only (get-billboard-info (billboard-hash (buff 32)))
  (map-get? billboard-info billboard-hash)
)

(define-read-only (get-agent-reputation (agent principal))
  (map-get? agent-reputation agent)
)

(define-read-only (get-grader-info (grader principal))
  (map-get? graders grader)
)

(define-read-only (get-admin)
  (var-get admin)
)

;; Helper to convert average-bp to display format
(define-read-only (get-agent-average-grade (agent principal))
  (match (map-get? agent-reputation agent)
    rep (some (/ (get average-bp rep) u2000))  ;; Returns 0-5
    none
  )
)
