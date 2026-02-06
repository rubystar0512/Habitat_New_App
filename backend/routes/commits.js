const express = require('express');
const { Op, col, Sequelize } = require('sequelize');
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
    try {
      // Execute SET statements separately to avoid syntax errors
      await sequelize.query('SET SESSION sort_buffer_size = 67108864', { type: sequelize.QueryTypes.RAW });
      await sequelize.query('SET SESSION read_buffer_size = 4194304', { type: sequelize.QueryTypes.RAW });
      await sequelize.query('SET SESSION read_rnd_buffer_size = 8388608', { type: sequelize.QueryTypes.RAW });
    } catch (optError) {
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

    // Filter by test file percent (calculated as test_additions / additions * 100)
    const testFilePercentConditions = [];
    if (req.query.min_test_file_percent !== undefined && req.query.min_test_file_percent !== '') {
      const minPercent = parseFloat(req.query.min_test_file_percent);
      if (!isNaN(minPercent)) {
        testFilePercentConditions.push(
          sequelize.literal(`(CASE WHEN additions > 0 THEN (test_additions / additions * 100) ELSE 0 END) >= ${minPercent}`)
        );
      }
    }
    if (req.query.max_test_file_percent !== undefined && req.query.max_test_file_percent !== '') {
      const maxPercent = parseFloat(req.query.max_test_file_percent);
      if (!isNaN(maxPercent)) {
        testFilePercentConditions.push(
          sequelize.literal(`(CASE WHEN additions > 0 THEN (test_additions / additions * 100) ELSE 0 END) <= ${maxPercent}`)
        );
      }
    }
    if (testFilePercentConditions.length > 0) {
      if (where[Op.and]) {
        where[Op.and] = Array.isArray(where[Op.and]) ? [...where[Op.and], ...testFilePercentConditions] : [where[Op.and], ...testFilePercentConditions];
      } else {
        where[Op.and] = testFilePercentConditions;
      }
    }

    // Filter by display status (server-side so we can paginate correctly)
    const allowedDisplayStatuses = ['reserved', 'available', 'paid_out', 'unavailable', 'too_easy', 'already_reserved', 'in_distribution', 'pending_admin_approval', 'failed', 'error', 'memo'];
    const displayStatus = (req.query.display_status || req.query.status || '').trim().toLowerCase();
    if (displayStatus && allowedDisplayStatuses.includes(displayStatus)) {
      const userId = parseInt(req.userId, 10);
      if (displayStatus === 'reserved') {
        where.id = {
          [Op.in]: sequelize.literal(`(SELECT commit_id FROM reservations WHERE user_id = ${userId} AND status = 'reserved')`)
        };
      } else if (displayStatus === 'memo') {
        // Filter for commits in user's memo
        where.id = {
          [Op.in]: sequelize.literal(`(SELECT commit_id FROM memo_commits WHERE user_id = ${userId})`)
        };
      } else if (displayStatus === 'available') {
        const existingWhere = { ...where };
        where[Op.and] = [
          existingWhere,
          { id: { [Op.notIn]: sequelize.literal(`(SELECT commit_id FROM reservations WHERE user_id = ${userId} AND status = 'reserved')`) } },
          {
            [Op.or]: [
              { id: { [Op.notIn]: sequelize.literal(`(SELECT commit_id FROM commit_status_cache)`) } },
              { id: { [Op.in]: sequelize.literal(`(SELECT commit_id FROM commit_status_cache WHERE status = 'available')`) } }
            ]
          }
        ];
      } else {
        // paid_out, unavailable, too_easy, etc.
        where.id = {
          [Op.in]: sequelize.literal(`(SELECT commit_id FROM commit_status_cache WHERE status = '${displayStatus.replace(/'/g, "''")}')`)
        };
      }
    }

    const include = [
      {
        model: GitRepo,
        as: 'repo',
        required: true,
        attributes: ['id', 'repoName', 'fullName', 'cutoffDate']
      }
    ];

    // Filter commits above each repo's cutoff date
    const cutoffDateCondition = Sequelize.literal(`(
      (SELECT cutoff_date FROM git_repos WHERE git_repos.id = \`Commit\`.\`repo_id\`) IS NULL
      OR 
      (
        (SELECT cutoff_date FROM git_repos WHERE git_repos.id = \`Commit\`.\`repo_id\`) IS NOT NULL 
        AND \`Commit\`.\`commit_date\` IS NOT NULL 
        AND DATE(\`Commit\`.\`commit_date\`) > DATE((SELECT cutoff_date FROM git_repos WHERE git_repos.id = \`Commit\`.\`repo_id\`))
      )
    )`);
    
    if (where[Op.and]) {
      where[Op.and] = Array.isArray(where[Op.and]) ? [...where[Op.and], cutoffDateCondition] : [where[Op.and], cutoffDateCondition];
    } else {
      where[Op.and] = [cutoffDateCondition];
    }

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

    // Execute query with retry logic for sort memory errors
    let commits;
    try {
      commits = await Commit.findAll(queryOptions);
    } catch (error) {
      // If sort memory error, try with even larger buffer and retry once
      if (error.name === 'SequelizeDatabaseError' && 
          (error.parent?.code === 'ER_OUT_OF_SORTMEMORY' || error.parent?.errno === 1038)) {
        console.warn('[Commits] Sort memory error detected, retrying with larger buffer (128MB)...');
        try {
          // Execute SET statements separately to avoid syntax errors
          await sequelize.query('SET SESSION sort_buffer_size = 134217728', { type: sequelize.QueryTypes.RAW });
          await sequelize.query('SET SESSION read_buffer_size = 8388608', { type: sequelize.QueryTypes.RAW });
          await sequelize.query('SET SESSION read_rnd_buffer_size = 16777216', { type: sequelize.QueryTypes.RAW });
          commits = await Commit.findAll(queryOptions);
        } catch (retryError) {
          console.error('[Commits] Retry failed, returning error:', retryError.message);
          throw retryError;
        }
      } else {
        throw error;
      }
    }

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

    const hasBase = baseCommit.length >= 7;
    const hasRepo = repoId && !Number.isNaN(repoId);

    if (!hasBase && !hasRepo) {
      return res.status(400).json({ error: 'Provide base_commit (min 7 chars) or repo_id to load chains' });
    }

    const repoWhere = hasRepo ? { repoId } : {};
    let allCommits = [];
    const commitByBase = new Map();
    let rootsToBuild = [];
    let singleRootLabel = '';

    if (hasBase) {
      const baseTrim = baseCommit.trim();
      let baseHashes = [baseTrim];
      const useLike = baseTrim.length < 40;
      const seenBases = new Set();

      for (let d = 0; d < maxDepth && baseHashes.length > 0; d++) {
        const whereClause = hasRepo ? { ...repoWhere } : {};
        if (d === 0 && useLike) {
          whereClause.baseCommit = { [Op.like]: `${baseTrim}%` };
        } else {
          whereClause.baseCommit = { [Op.in]: baseHashes };
        }
        const next = await Commit.findAll({
          where: whereClause,
          attributes: ['id', 'repoId', 'baseCommit', 'mergedCommit', 'habitateScore', 'suitabilityScore', 'difficultyScore', 'message'],
          include: [{ model: GitRepo, as: 'repo', attributes: ['id', 'repoName', 'fullName'] }]
        });
        allCommits.push(...next);
        baseHashes = [...new Set(next.map(c => (c.mergedCommit || '').trim()).filter(Boolean))].filter(h => !seenBases.has(h));
        baseHashes.forEach(h => seenBases.add(h));
      }

      allCommits.forEach(c => {
        const key = (c.baseCommit || '').trim();
        if (!commitByBase.has(key)) commitByBase.set(key, []);
        commitByBase.get(key).push(c);
      });
      if (useLike) {
        const firstLevel = allCommits.filter(c => (c.baseCommit || '').trim().startsWith(baseTrim));
        if (firstLevel.length > 0) commitByBase.set(baseTrim, firstLevel);
      }
      rootsToBuild = [baseTrim];
      singleRootLabel = (baseTrim || '').substring(0, 8) + (baseTrim.length > 8 ? '...' : '');
    } else {
      const repoCommits = await Commit.findAll({
        where: { repoId },
        attributes: ['id', 'repoId', 'baseCommit', 'mergedCommit', 'habitateScore', 'suitabilityScore', 'difficultyScore', 'message'],
        include: [{ model: GitRepo, as: 'repo', attributes: ['id', 'repoName', 'fullName'] }]
      });
      allCommits = repoCommits;
      const mergedInRepo = new Set(repoCommits.map(c => (c.mergedCommit || '').trim()).filter(Boolean));
      allCommits.forEach(c => {
        const key = (c.baseCommit || '').trim();
        if (!key) return;
        if (!commitByBase.has(key)) commitByBase.set(key, []);
        commitByBase.get(key).push(c);
      });
      rootsToBuild = [...new Set(allCommits.map(c => (c.baseCommit || '').trim()).filter(Boolean))].filter(base => !mergedInRepo.has(base));
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
        const status = statusByCommitId.get(commit.id);
        const merged = (commit.mergedCommit || '').trim();
        const childNode = buildNode(merged, depth + 1);
        const shortMerged = (commit.mergedCommit || '').substring(0, 8);
        const label = `${shortMerged} (id:${commit.id}${status ? ` ${status}` : ''})`;
        children.push({
          name: label,
          value: commit.id,
          commitId: commit.id,
          baseCommit: commit.baseCommit,
          mergedCommit: commit.mergedCommit,
          habitateScore: commit.habitateScore,
          suitabilityScore: commit.suitabilityScore,
          difficultyScore: commit.difficultyScore,
          status: status || null,
          repoName: commit.repo?.fullName || commit.repo?.repoName,
          children: (childNode && childNode.children && childNode.children.length > 0) ? childNode.children : []
        });
      }

      const rootLabel = (baseHash || '').substring(0, 8) + ((baseHash || '').length > 8 ? '...' : '');
      if (depth === 0) {
        return {
          name: children.length === 0 ? `${rootLabel} (no merge commits)` : `${rootLabel} (root)`,
          children
        };
      }
      return { name: key.substring(0, 8), children };
    }

    const countNodes = (n) => 1 + (n.children || []).reduce((sum, c) => sum + countNodes(c), 0);
    const maxChainDepthFn = (n) => {
      if (!n.children || n.children.length === 0) return 1;
      return 1 + Math.max(...n.children.map(maxChainDepthFn));
    };
    const countCommitNodes = (n) => (n.commitId ? 1 : 0) + (n.children || []).reduce((sum, c) => sum + countCommitNodes(c), 0);

    const trees = [];
    for (const rootHash of rootsToBuild) {
      const tree = buildNode(rootHash, 0);
      if (tree && (tree.children?.length > 0 || hasBase)) {
        trees.push(tree);
      }
    }

    if (hasBase) {
      const singleTree = trees[0] || { name: `${singleRootLabel} (no merge commits found)`, children: [] };
      return res.json({
        tree: singleTree,
        trees: null,
        totalNodes: countNodes(singleTree),
        chainDepth: singleTree.children?.length ? maxChainDepthFn(singleTree) : 0,
        totalCommitNodes: countCommitNodes(singleTree)
      });
    }

    let totalNodes = 0;
    let chainDepth = 0;
    let totalCommitNodes = 0;
    for (const t of trees) {
      totalNodes += countNodes(t);
      chainDepth = Math.max(chainDepth, maxChainDepthFn(t));
      totalCommitNodes += countCommitNodes(t);
    }
    res.json({
      tree: trees.length === 1 ? trees[0] : null,
      trees: trees.length > 1 ? trees : null,
      totalNodes,
      chainDepth,
      totalCommitNodes
    });
  } catch (error) {
    next(error);
  }
});

// Find similar commits by score patterns (habitate, suitability, difficulty)
router.get('/:id/similar', idParamRule, handleValidationErrors, async (req, res, next) => {
  try {
    const commitId = parseInt(req.params.id, 10);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 50);
    const sameRepo = req.query.same_repo === 'true' || req.query.same_repo === '1';

    const commit = await Commit.findByPk(commitId, {
      attributes: ['id', 'repoId', 'habitateScore', 'suitabilityScore', 'difficultyScore', 'mergedCommit', 'baseCommit', 'message', 'commitDate'],
      include: [{ model: GitRepo, as: 'repo', attributes: ['id', 'repoName', 'fullName'] }]
    });
    if (!commit) {
      return res.status(404).json({ error: 'Commit not found' });
    }

    const h = commit.habitateScore != null ? Number(commit.habitateScore) : 0;
    const s = commit.suitabilityScore != null ? Number(commit.suitabilityScore) : 0;
    const d = commit.difficultyScore != null ? Number(commit.difficultyScore) : 0;

    const where = { id: { [Op.ne]: commitId } };
    if (sameRepo && commit.repoId) where.repoId = commit.repoId;

    const similar = await Commit.findAll({
      where,
      limit,
      attributes: ['id', 'repoId', 'habitateScore', 'suitabilityScore', 'difficultyScore', 'mergedCommit', 'baseCommit', 'message', 'commitDate', 'additions', 'deletions', 'fileChanges'],
      include: [{ model: GitRepo, as: 'repo', attributes: ['id', 'repoName', 'fullName'], where: { isActive: true }, required: true }],
      order: [
        [sequelize.literal(`(ABS(COALESCE(habitate_score, 0) - ${h}) + ABS(COALESCE(suitability_score, 0) - ${s}) + ABS(COALESCE(difficulty_score, 0) - ${d}))`), 'ASC']
      ]
    });

    const similarIds = similar.map(c => c.id);
    const statusByCommitId = new Map();
    if (similarIds.length > 0) {
      const statuses = await CommitStatusCache.findAll({
        where: { commitId: { [Op.in]: similarIds } },
        attributes: ['commitId', 'status']
      });
      statuses.forEach(st => statusByCommitId.set(st.commitId, st.status));
    }

    const similarWithStatus = similar.map(c => {
      const row = c.toJSON();
      row.status = statusByCommitId.get(c.id) || null;
      return row;
    });

    res.json({ commit: commit.toJSON(), similar: similarWithStatus });
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

// Bulk mark commits as unsuitable
router.post('/bulk-mark-unsuitable', async (req, res, next) => {
  try {
    const { commit_ids: commitIds } = req.body;
    if (!Array.isArray(commitIds) || commitIds.length === 0) {
      return res.status(400).json({ error: 'commit_ids array is required' });
    }
    const ids = commitIds.map(id => parseInt(id, 10)).filter(n => n > 0);
    const [updated] = await Commit.update(
      { isUnsuitable: true, unsuitableReason: 'Manually marked as unsuitable' },
      { where: { id: { [Op.in]: ids } } }
    );
    res.json({ message: `Marked ${updated} commit(s) as unsuitable`, updated });
  } catch (error) {
    next(error);
  }
});

// Bulk unmark commits as unsuitable
router.post('/bulk-unmark-unsuitable', async (req, res, next) => {
  try {
    const { commit_ids: commitIds } = req.body;
    if (!Array.isArray(commitIds) || commitIds.length === 0) {
      return res.status(400).json({ error: 'commit_ids array is required' });
    }
    const ids = commitIds.map(id => parseInt(id, 10)).filter(n => n > 0);
    const [updated] = await Commit.update(
      { isUnsuitable: false, unsuitableReason: null },
      { where: { id: { [Op.in]: ids } } }
    );
    res.json({ message: `Unmarked ${updated} commit(s) as unsuitable`, updated });
  } catch (error) {
    next(error);
  }
});

const MEMO_LIMIT = Math.max(1, parseInt(process.env.MEMO_LIMIT, 10) || 45);

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

    const alreadyInMyMemo = await MemoCommit.findOne({ where: { userId: req.userId, commitId } });
    if (!alreadyInMyMemo) {
      const currentCount = await MemoCommit.count({ where: { userId: req.userId } });
      if (currentCount >= MEMO_LIMIT) {
        return res.status(403).json({
          error: `Memo limit reached (${MEMO_LIMIT}). Remove an item to add more.`,
          memoLimit: MEMO_LIMIT
        });
      }
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

    const accountId = parseInt(account_id, 10);
    if (isNaN(accountId)) {
      return res.status(400).json({ error: 'Invalid account_id' });
    }

    // Verify account belongs to user
    const account = await UserHabitatAccount.findOne({
      where: { id: accountId, userId: req.userId, isActive: true }
    });

    if (!account) {
      return res.status(404).json({ error: 'Account not found or inactive' });
    }

    const commitId = parseInt(req.params.id, 10);
    if (isNaN(commitId)) {
      return res.status(400).json({ error: 'Invalid commit ID' });
    }

    // Check if already reserved
    const existingReservation = await Reservation.findOne({
      where: {
        commitId: commitId,
        userId: req.userId,
        status: 'reserved'
      }
    });

    if (existingReservation) {
      return res.status(400).json({ error: 'Commit already reserved' });
    }

    // Get commit and repo info
    const commit = await Commit.findByPk(commitId, {
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
      accountId: accountId,
      commitId: commitId,
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
    const commitId = parseInt(req.params.id, 10);
    if (isNaN(commitId)) {
      return res.status(400).json({ error: 'Invalid commit ID' });
    }

    const reservation = await Reservation.findOne({
      where: {
        commitId: commitId,
        userId: req.userId,
        status: 'reserved'
      },
      include: [{ 
        model: UserHabitatAccount, 
        as: 'account',
        required: false // Allow reservations without accounts (though shouldn't happen)
      }]
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

// Gift commit: send reserved commit to another team member (release from sender, reserve on receiver)
router.post('/:id/gift', idParamRule, handleValidationErrors, async (req, res, next) => {
  try {
    const commitId = parseInt(req.params.id, 10);
    const senderId = parseInt(req.userId, 10);
    const { receiver_user_id, receiver_account_id } = req.body;

    if (!receiver_user_id) {
      return res.status(400).json({ error: 'receiver_user_id is required' });
    }
    if (!receiver_account_id) {
      return res.status(400).json({ error: 'receiver_account_id is required – sender must select the receiver\'s Habitat account' });
    }
    const receiverId = parseInt(receiver_user_id, 10);
    const receiverAccountId = parseInt(receiver_account_id, 10);
    
    if (isNaN(receiverId)) {
      return res.status(400).json({ error: 'Invalid receiver_user_id' });
    }
    if (isNaN(receiverAccountId)) {
      return res.status(400).json({ error: 'Invalid receiver_account_id' });
    }
    
    if (receiverId === senderId) {
      return res.status(400).json({ error: 'Cannot gift commit to yourself' });
    }

    const senderReservation = await Reservation.findOne({
      where: {
        commitId,
        userId: senderId,
        status: 'reserved'
      },
      include: [{ 
        model: UserHabitatAccount, 
        as: 'account',
        required: false // Allow reservations without accounts (though shouldn't happen)
      }]
    });

    if (!senderReservation) {
      return res.status(404).json({ error: 'You do not have this commit reserved' });
    }

    const commit = await Commit.findByPk(commitId, {
      include: [{ model: GitRepo, as: 'repo', attributes: ['id', 'habitatRepoId'] }]
    });
    if (!commit || !commit.repo?.habitatRepoId) {
      return res.status(400).json({ error: 'Commit or repo not found' });
    }

    const receiverAccount = await UserHabitatAccount.findOne({
      where: { id: receiverAccountId, userId: receiverId, isActive: true }
    });
    if (!receiverAccount) {
      return res.status(404).json({ error: 'Receiver account not found or inactive' });
    }

    const senderApiUrl = senderReservation.account.apiUrl || process.env.HABITAT_API_URL || 'https://code.habitat.inc';

    if (senderReservation.habitatReservationId) {
      const deleteResult = await deleteReservation(
        senderReservation.account.apiToken,
        senderApiUrl,
        senderReservation.habitatReservationId
      );
      if (!deleteResult.success) {
        return res.status(400).json({ error: deleteResult.error || 'Failed to release commit on Habitat' });
      }
    }

    await senderReservation.update({
      status: 'released',
      cancelledAt: new Date()
    });

    const receiverApiUrl = receiverAccount.apiUrl || process.env.HABITAT_API_URL || 'https://code.habitat.inc';
    const claimResult = await claim(
      receiverAccount.apiToken,
      receiverApiUrl,
      commit.repo.habitatRepoId,
      commit.baseCommit
    );

    if (!claimResult.success) {
      return res.status(400).json({
        error: claimResult.error || 'Failed to reserve commit for receiver. Commit may now be available on Habitat.'
      });
    }

    const newReservation = await Reservation.create({
      userId: receiverId,
      accountId: receiverAccount.id,
      commitId,
      habitatReservationId: claimResult.reservationId,
      status: 'reserved',
      expiresAt: claimResult.expiresAt,
      reservedAt: new Date()
    });

    res.json({
      message: 'Commit gifted successfully',
      reservation: newReservation
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
