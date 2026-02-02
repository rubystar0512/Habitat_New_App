const express = require('express');
const { Op, col } = require('sequelize');
const { Commit, GitRepo, CommitFile, CommitFileStatsCache, Reservation, MemoCommit, CommitStatusCache, UserHabitatAccount, User } = require('../models');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { commitFilterRules, paginationRules, handleValidationErrors, idParamRule } = require('../middleware/validation');
const { claim, deleteReservation } = require('../services/habitatApi');
const { sequelize } = require('../config/database');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Get commits with filtering
router.get('/', commitFilterRules, paginationRules, handleValidationErrors, async (req, res, next) => {
  try {
    // Optimize MySQL sort buffer for large dataset sorting
    // Set session variables to increase sort buffer size (16MB instead of default 256KB)
    try {
      await sequelize.query(`
        SET SESSION sort_buffer_size = 16777216;
        SET SESSION read_buffer_size = 2097152;
        SET SESSION read_rnd_buffer_size = 4194304;
      `, { type: sequelize.QueryTypes.RAW });
    } catch (optError) {
      // If setting session variables fails, log but continue
      console.warn('Failed to set MySQL optimization variables:', optError.message);
    }

    const limit = req.query.limit || 50;
    const offset = req.query.offset || 0;

    // Build where clause
    const where = {};
    // Support repo_ids (array) or repo_id (single)
    const repoIdsRaw = req.query.repo_ids ?? req.query.repo_id;
    if (repoIdsRaw !== undefined && repoIdsRaw !== '') {
      const ids = Array.isArray(repoIdsRaw)
        ? repoIdsRaw.map(id => parseInt(id, 10)).filter(n => !Number.isNaN(n))
        : [parseInt(repoIdsRaw, 10)].filter(n => !Number.isNaN(n));
      if (ids.length > 0) {
        where.repoId = ids.length === 1 ? ids[0] : { [Op.in]: ids };
      }
    }
    if (req.query.min_habitate_score) {
      where.habitateScore = { [Op.gte]: parseInt(req.query.min_habitate_score) };
    }
    if (req.query.max_habitate_score) {
      where.habitateScore = { ...where.habitateScore, [Op.lte]: parseInt(req.query.max_habitate_score) };
    }
    if (req.query.min_difficulty_score) {
      where.difficultyScore = { [Op.gte]: parseFloat(req.query.min_difficulty_score) };
    }
    if (req.query.max_difficulty_score) {
      where.difficultyScore = { ...where.difficultyScore, [Op.lte]: parseFloat(req.query.max_difficulty_score) };
    }
    if (req.query.min_suitability_score) {
      where.suitabilityScore = { [Op.gte]: parseFloat(req.query.min_suitability_score) };
    }
    if (req.query.max_suitability_score) {
      where.suitabilityScore = { ...where.suitabilityScore, [Op.lte]: parseFloat(req.query.max_suitability_score) };
    }
    if (req.query.min_additions) {
      where.additions = { [Op.gte]: parseInt(req.query.min_additions) };
    }
    if (req.query.max_additions) {
      where.additions = { ...where.additions, [Op.lte]: parseInt(req.query.max_additions) };
    }
    if (req.query.min_deletions) {
      where.deletions = { [Op.gte]: parseInt(req.query.min_deletions) };
    }
    if (req.query.max_deletions) {
      where.deletions = { ...where.deletions, [Op.lte]: parseInt(req.query.max_deletions) };
    }
    if (req.query.min_net_change) {
      where.netChange = { [Op.gte]: parseInt(req.query.min_net_change) };
    }
    if (req.query.max_net_change) {
      where.netChange = { ...where.netChange, [Op.lte]: parseInt(req.query.max_net_change) };
    }
    if (req.query.min_file_changes) {
      where.fileChanges = { [Op.gte]: parseInt(req.query.min_file_changes) };
    }
    if (req.query.max_file_changes) {
      where.fileChanges = { ...where.fileChanges, [Op.lte]: parseInt(req.query.max_file_changes) };
    }
    if (req.query.is_merge !== undefined) {
      where.isMerge = req.query.is_merge === 'true';
    }
    if (req.query.author) {
      where.author = { [Op.like]: `%${req.query.author}%` };
    }
    if (req.query.merged_commit) {
      where.mergedCommit = { [Op.like]: `%${req.query.merged_commit}%` };
    }
    if (req.query.base_commit) {
      where.baseCommit = { [Op.like]: `%${req.query.base_commit}%` };
    }
    if (req.query.pr_number) {
      where.prNumber = parseInt(req.query.pr_number);
    }
    if (req.query.message) {
      where.message = { [Op.like]: `%${req.query.message}%` };
    }
    if (req.query.date_from) {
      where.commitDate = { ...where.commitDate, [Op.gte]: new Date(req.query.date_from) };
    }
    if (req.query.date_to) {
      where.commitDate = { ...where.commitDate, [Op.lte]: new Date(req.query.date_to + 'T23:59:59') };
    }
    if (req.query.has_dependency_changes !== undefined) {
      where.hasDependencyChanges = req.query.has_dependency_changes === 'true';
    }
    if (req.query.is_unsuitable !== undefined) {
      where.isUnsuitable = req.query.is_unsuitable === 'true';
    }
    if (req.query.is_behavior_preserving_refactor !== undefined) {
      where.isBehaviorPreservingRefactor = req.query.is_behavior_preserving_refactor === 'true';
    }

    const include = [
      {
        model: GitRepo,
        as: 'repo',
        attributes: ['id', 'repoName', 'fullName']
      }
    ];

    // Handle search parameter (searches across multiple fields)
    if (req.query.search) {
      const searchTerm = req.query.search.trim();
      // Check if it looks like a commit hash (7-40 hex characters)
      if (/^[a-f0-9]{7,40}$/i.test(searchTerm)) {
        // Search by commit hash (partial match on base_commit, merged_commit, or source_sha)
        where[Op.or] = [
          { baseCommit: { [Op.like]: `%${searchTerm}%` } },
          { mergedCommit: { [Op.like]: `%${searchTerm}%` } },
          { sourceSha: { [Op.like]: `%${searchTerm}%` } }
        ];
      } else {
        // Search by text (repo name, message, author, etc.)
        where[Op.or] = [
          { message: { [Op.like]: `%${searchTerm}%` } },
          { author: { [Op.like]: `%${searchTerm}%` } }
        ];
        // Also search in repo name - modify existing repo include
        const repoInclude = include.find(inc => inc.as === 'repo');
        if (repoInclude) {
          // Modify existing repo include to add search
          if (repoInclude.where) {
            const existingOr = repoInclude.where[Op.or] || [];
            repoInclude.where[Op.or] = [
              ...existingOr,
              { repoName: { [Op.like]: `%${searchTerm}%` } },
              { fullName: { [Op.like]: `%${searchTerm}%` } }
            ];
          } else {
            repoInclude.where = {
              [Op.or]: [
                { repoName: { [Op.like]: `%${searchTerm}%` } },
                { fullName: { [Op.like]: `%${searchTerm}%` } }
              ]
            };
            repoInclude.required = false;
          }
        }
      }
    }

    // Handle file pattern filters using cache table
    if (req.query.single_file_200plus === 'true') {
      include.push({
        model: CommitFileStatsCache,
        as: 'fileStatsCache',
        where: { singleFile200plus: true },
        required: true
      });
    }

    if (req.query.multi_file_300plus === 'true') {
      include.push({
        model: CommitFileStatsCache,
        as: 'fileStatsCache',
        where: { multiFile300plus: true },
        required: true
      });
    }

    // Handle sorting
    let order = [['habitate_score', 'DESC'], ['commit_date', 'DESC']];
    if (req.query.sort_field) {
      const sortOrder = req.query.sort_order === 'ASC' ? 'ASC' : 'DESC';
      const sortField = req.query.sort_field;
      // Map frontend field names to database field names
      const fieldMap = {
        'habitateScore': 'habitate_score',
        'habitate_score': 'habitate_score',
        'difficultyScore': 'difficulty_score',
        'difficulty_score': 'difficulty_score',
        'suitabilityScore': 'suitability_score',
        'suitability_score': 'suitability_score',
        'commitDate': 'commit_date',
        'commit_date': 'commit_date',
        'fileChanges': 'file_changes',
        'file_changes': 'file_changes',
        'netChange': 'net_change',
        'net_change': 'net_change',
        'isMerge': 'is_merge',
        'is_merge': 'is_merge',
        'prNumber': 'pr_number',
        'pr_number': 'pr_number',
        'baseCommit': 'base_commit',
        'base_commit': 'base_commit',
        'mergedCommit': 'merged_commit',
        'merged_commit': 'merged_commit',
        'hasDependencyChanges': 'has_dependency_changes',
        'has_dependency_changes': 'has_dependency_changes',
        'isUnsuitable': 'is_unsuitable',
        'is_unsuitable': 'is_unsuitable',
        'isBehaviorPreservingRefactor': 'is_behavior_preserving_refactor',
        'is_behavior_preserving_refactor': 'is_behavior_preserving_refactor',
        'additions': 'additions',
        'deletions': 'deletions',
        'author': 'author',
      };
      const dbField = fieldMap[sortField] || sortField;
      order = [[dbField, sortOrder]];
    }

    const countIncludes = include.filter(inc => !inc.required);
    const countOptions = {
      where,
      include: countIncludes.length > 0 ? countIncludes : undefined,
      distinct: true
    };

    const count = await Commit.count(countOptions);

    const hasJoins = include.length > 0;
    const queryOptions = {
      where,
      include,
      limit,
      offset,
      order,
      subQuery: hasJoins
    };

    const MAX_SAFE_OFFSET = 50000;
    if (offset > MAX_SAFE_OFFSET) {
      console.warn(`Large offset detected: ${offset}. This may cause sort memory issues.`);
    }

    const commits = await Commit.findAll(queryOptions);

    // Get user's accounts to fetch status cache
    const userAccounts = await UserHabitatAccount.findAll({
      where: { userId: req.userId, isActive: true },
      attributes: ['id']
    });
    const accountIds = userAccounts.map(acc => acc.id);

    // Get reservations for these commits
    const commitIds = commits.map(c => c.id);
    const reservations = await Reservation.findAll({
      where: {
        commitId: { [Op.in]: commitIds },
        userId: req.userId,
        status: 'reserved' // Database uses 'reserved' status
      },
      attributes: ['id', 'commitId', 'accountId', 'status', 'expiresAt', 'habitatReservationId']
    });

    // Get memo commits for this user
    const memoCommits = await MemoCommit.findAll({
      where: {
        commitId: { [Op.in]: commitIds },
        userId: req.userId
      },
      attributes: ['commitId']
    });
    const memoCommitIds = new Set(memoCommits.map(m => m.commitId));

    // Get memo commits by other users (to show who has memoed each commit)
    const otherUserMemos = await MemoCommit.findAll({
      where: {
        commitId: { [Op.in]: commitIds },
        userId: { [Op.ne]: req.userId }
      },
      include: [{
        model: User,
        as: 'user',
        attributes: ['id', 'username', 'email']
      }],
      attributes: ['commitId', 'userId']
    });
    const memoedByMap = {};
    otherUserMemos.forEach(memo => {
      if (!memoedByMap[memo.commitId]) {
        memoedByMap[memo.commitId] = {
          userId: memo.userId,
          username: memo.user?.username || null
        };
      }
    });

    // Get status cache (global per commit, no account filter needed)
    const statusCache = await CommitStatusCache.findAll({
      where: {
        commitId: { [Op.in]: commitIds }
      },
      attributes: ['commitId', 'status', 'expiresAt', 'checkedAt']
    });

    // Build status map: commitId -> { status, expiresAt }
    const statusMap = {};
    statusCache.forEach(sc => {
      statusMap[sc.commitId] = {
        status: sc.status,
        expiresAt: sc.expiresAt,
        checkedAt: sc.checkedAt
      };
    });

    // Build reservation map
    const reservationMap = {};
    reservations.forEach(r => {
      reservationMap[r.commitId] = {
        id: r.id,
        accountId: r.accountId,
        status: r.status,
        expiresAt: r.expiresAt,
        habitatReservationId: r.habitatReservationId
      };
    });

    // Attach status and reservation info to commits
    const commitsWithStatus = commits.map(commit => {
      const commitData = commit.toJSON();
      commitData.isInMemo = memoCommitIds.has(commit.id);
      commitData.memoedBy = memoedByMap[commit.id] || null; // Info about who else has memoed this commit
      commitData.userReservation = reservationMap[commit.id] || null;
      commitData.statusInfo = statusMap[commit.id] || null;
      
      // Determine display status
      if (commitData.userReservation) {
        commitData.displayStatus = 'reserved';
        commitData.expiresAt = commitData.userReservation.expiresAt;
      } else if (commitData.statusInfo) {
        commitData.displayStatus = commitData.statusInfo.status || 'available';
        commitData.expiresAt = commitData.statusInfo.expiresAt;
      } else {
        commitData.displayStatus = 'available';
        commitData.expiresAt = null;
      }

      return commitData;
    });

    res.json({
      commits: commitsWithStatus,
      total: count,
      limit,
      offset
    });
  } catch (error) {
    next(error);
  }
});

router.get('/commit-chain', requireAdmin, async (req, res, next) => {
  try {
    const baseCommit = (req.query.base_commit || '').trim();
    const repoId = req.query.repo_id ? parseInt(req.query.repo_id, 10) : null;
    const maxDepth = Math.min(Math.max(parseInt(req.query.max_depth, 10) || 10, 1), 50);

    if (!baseCommit || baseCommit.length < 7) {
      return res.status(400).json({ error: 'base_commit is required (min 7 characters)' });
    }

    const repoWhere = repoId && !Number.isNaN(repoId) ? { repoId } : {};

    // Fetch chain iteratively: start from base_commit (LIKE for first level), then exact match for chained merged hashes
    const allCommits = [];
    const baseTrim = baseCommit.trim();
    let baseHashes = [baseTrim];
    const useLike = baseTrim.length < 40; // partial hash: use LIKE for first level
    const seenBases = new Set();

    for (let d = 0; d < maxDepth && baseHashes.length > 0; d++) {
      const whereClause = repoId && !Number.isNaN(repoId) ? { ...repoWhere } : {};
      if (d === 0 && useLike) {
        whereClause.baseCommit = { [Op.like]: `${baseTrim}%` };
      } else {
        whereClause.baseCommit = { [Op.in]: baseHashes };
      }
      const next = await Commit.findAll({
        where: whereClause,
        attributes: ['id', 'repoId', 'baseCommit', 'mergedCommit', 'habitateScore', 'message'],
        include: [
          { model: GitRepo, as: 'repo', attributes: ['id', 'repoName', 'fullName'] }
        ]
      });
      allCommits.push(...next);
      baseHashes = [...new Set(next.map(c => (c.mergedCommit || '').trim()).filter(Boolean))].filter(h => !seenBases.has(h));
      baseHashes.forEach(h => seenBases.add(h));
    }

    const commitByBase = new Map();
    allCommits.forEach(c => {
      const key = (c.baseCommit || '').trim();
      if (!commitByBase.has(key)) commitByBase.set(key, []);
      commitByBase.get(key).push(c);
    });
    // When user sent partial hash, point root at all commits whose base starts with it
    if (useLike) {
      const firstLevel = allCommits.filter(c => (c.baseCommit || '').trim().startsWith(baseTrim));
      if (firstLevel.length > 0) {
        commitByBase.set(baseTrim, firstLevel);
      }
    }

    const statusByCommitId = new Map();
    const commitIds = [...new Set(allCommits.map(c => c.id))];
    if (commitIds.length > 0) {
      const statuses = await CommitStatusCache.findAll({
        where: { commitId: { [Op.in]: commitIds } },
        attributes: ['commitId', 'status']
      });
      statuses.forEach(s => statusByCommitId.set(s.commitId, s.status));
    }

    const visited = new Set();

    function buildNode(baseHash, depth) {
      if (depth > maxDepth) return null;
      const key = (baseHash || '').trim();
      if (visited.has(key)) return null;
      const childrenCommits = commitByBase.get(key) || [];
      visited.add(key);

      const children = [];
      for (const commit of childrenCommits) {
        const merged = (commit.mergedCommit || '').trim();
        const childNode = buildNode(merged, depth + 1);
        const status = statusByCommitId.get(commit.id);
        const shortMerged = (commit.mergedCommit || '').substring(0, 8);
        const label = `${shortMerged} (id:${commit.id}${status ? ` ${status}` : ''})`;
        children.push({
          name: label,
          value: commit.id,
          commitId: commit.id,
          baseCommit: commit.baseCommit,
          mergedCommit: commit.mergedCommit,
          habitateScore: commit.habitateScore,
          status: status || null,
          repoName: commit.repo?.fullName || commit.repo?.repoName,
          children: (childNode && childNode.children && childNode.children.length > 0) ? childNode.children : []
        });
      }

      const rootLabel = (baseCommit || '').substring(0, 8) + (baseCommit.length > 8 ? '...' : '');
      if (depth === 0) {
        return {
          name: children.length === 0 ? `${rootLabel} (no merge commits found)` : `${rootLabel} (root)`,
          children
        };
      }
      return {
        name: key.substring(0, 8),
        children
      };
    }

    const rootLabel = (baseTrim || '').substring(0, 8) + (baseTrim.length > 8 ? '...' : '');
    const tree = buildNode(baseTrim, 0);

    if (!tree) {
      return res.json({
        tree: { name: `${rootLabel} (no merge commits found)`, children: [] },
        totalNodes: 0
      });
    }

    const countNodes = (n) => 1 + (n.children || []).reduce((sum, c) => sum + countNodes(c), 0);
    const totalNodes = countNodes(tree);

    res.json({ tree, totalNodes });
  } catch (error) {
    next(error);
  }
});

// Get commit by ID with details
router.get('/:id', async (req, res, next) => {
  try {
    const commit = await Commit.findByPk(req.params.id, {
      include: [
        {
          model: GitRepo,
          as: 'repo',
          attributes: ['id', 'repoName', 'fullName', 'cutoffDate']
        },
        {
          model: CommitFile,
          as: 'commitFiles',
          attributes: ['id', 'filePath', 'fileName', 'additions', 'deletions', 'isTestFile', 'isDependencyFile']
        }
      ]
    });

    if (!commit) {
      return res.status(404).json({ error: 'Commit not found' });
    }

    res.json({ commit });
  } catch (error) {
    next(error);
  }
});

// Mark commit as unsuitable
router.post('/:id/mark-unsuitable', idParamRule, handleValidationErrors, async (req, res, next) => {
  try {
    const { reason } = req.body;
    const commit = await Commit.findByPk(req.params.id);

    if (!commit) {
      return res.status(404).json({ error: 'Commit not found' });
    }

    await commit.update({
      isUnsuitable: true,
      unsuitableReason: reason || 'Manually marked as unsuitable'
    });

    res.json({ message: 'Commit marked as unsuitable', commit });
  } catch (error) {
    next(error);
  }
});

// Unmark commit as unsuitable
router.post('/:id/unmark-unsuitable', idParamRule, handleValidationErrors, async (req, res, next) => {
  try {
    const commit = await Commit.findByPk(req.params.id);

    if (!commit) {
      return res.status(404).json({ error: 'Commit not found' });
    }

    await commit.update({
      isUnsuitable: false,
      unsuitableReason: null
    });

    res.json({ message: 'Commit unmarked as unsuitable', commit });
  } catch (error) {
    next(error);
  }
});

// Add commit to memo
router.post('/:id/memo', idParamRule, handleValidationErrors, async (req, res, next) => {
  try {
    const { notes, priority } = req.body;
    const commitId = parseInt(req.params.id);

    // Check if commit is already memoed by another user
    const existingMemo = await MemoCommit.findOne({
      where: {
        commitId: commitId,
        userId: { [Op.ne]: req.userId }
      },
      include: [{
        model: User,
        as: 'user',
        attributes: ['id', 'username', 'email']
      }]
    });

    if (existingMemo) {
      return res.status(409).json({ 
        error: `This commit is already in ${existingMemo.user?.username || 'another team member'}'s memo`,
        memoedBy: {
          userId: existingMemo.userId,
          username: existingMemo.user?.username || null
        }
      });
    }

    const [memoCommit, created] = await MemoCommit.findOrCreate({
      where: {
        userId: req.userId,
        commitId: commitId
      },
      defaults: {
        userId: req.userId,
        commitId: commitId,
        notes: notes || null,
        priority: priority || 0
      }
    });

    if (!created) {
      await memoCommit.update({
        notes: notes !== undefined ? notes : memoCommit.notes,
        priority: priority !== undefined ? priority : memoCommit.priority
      });
    }

    res.json({ message: created ? 'Commit added to memo' : 'Memo updated', memoCommit });
  } catch (error) {
    next(error);
  }
});

// Remove commit from memo
router.delete('/:id/memo', idParamRule, handleValidationErrors, async (req, res, next) => {
  try {
    const deleted = await MemoCommit.destroy({
      where: {
        userId: req.userId,
        commitId: req.params.id
      }
    });

    if (deleted === 0) {
      return res.status(404).json({ error: 'Commit not in memo' });
    }

    res.json({ message: 'Commit removed from memo' });
  } catch (error) {
    next(error);
  }
});

// Reserve commit
router.post('/:id/reserve', idParamRule, handleValidationErrors, async (req, res, next) => {
  try {
    const { account_id } = req.body;

    if (!account_id) {
      return res.status(400).json({ error: 'account_id is required' });
    }

    // Verify account belongs to user
    const account = await UserHabitatAccount.findOne({
      where: { id: account_id, userId: req.userId, isActive: true }
    });

    if (!account) {
      return res.status(404).json({ error: 'Account not found or inactive' });
    }

    // Check if already reserved
    const existingReservation = await Reservation.findOne({
      where: {
        commitId: req.params.id,
        userId: req.userId,
        status: 'reserved'
      }
    });

    if (existingReservation) {
      return res.status(400).json({ error: 'Commit already reserved' });
    }

    // Get commit and repo info
    const commit = await Commit.findByPk(req.params.id, {
      include: [{ model: GitRepo, as: 'repo', attributes: ['habitatRepoId'] }]
    });

    if (!commit) {
      return res.status(404).json({ error: 'Commit not found' });
    }

    if (!commit.repo?.habitatRepoId) {
      return res.status(400).json({ error: 'Repository does not have Habitat ID' });
    }

    // Call Habitat API to reserve
    const apiUrl = account.apiUrl || process.env.HABITAT_API_URL || 'https://code.habitat.inc';
    const result = await claim(account.apiToken, apiUrl, commit.repo.habitatRepoId, commit.baseCommit);

    if (!result.success) {
      return res.status(400).json({ error: result.error || 'Failed to reserve commit' });
    }

    // Create reservation record
    const reservation = await Reservation.create({
      userId: req.userId,
      accountId: account_id,
      commitId: req.params.id,
      habitatReservationId: result.reservationId,
      status: 'reserved', // Database uses 'reserved' status
      expiresAt: result.expiresAt,
      reservedAt: new Date()
    });

    res.json({ message: 'Commit reserved successfully', reservation });
  } catch (error) {
    next(error);
  }
});

// Cancel reservation
router.delete('/:id/reserve', idParamRule, handleValidationErrors, async (req, res, next) => {
  try {
    const reservation = await Reservation.findOne({
      where: {
        commitId: req.params.id,
        userId: req.userId,
        status: 'reserved'
      },
      include: [{ model: UserHabitatAccount, as: 'account' }]
    });

    if (!reservation) {
      return res.status(404).json({ error: 'Reservation not found' });
    }

    // Cancel via Habitat API if reservation ID exists
    if (reservation.habitatReservationId) {
      const apiUrl = reservation.account.apiUrl || process.env.HABITAT_API_URL || 'https://code.habitat.inc';
      await deleteReservation(reservation.account.apiToken, apiUrl, reservation.habitatReservationId);
    }

    // Update reservation status
    await reservation.update({
      status: 'released', // Database uses 'released' for cancelled reservations
      cancelledAt: new Date() // This maps to 'released_at' in database
    });

    res.json({ message: 'Reservation cancelled successfully' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
