<?php
$rows = $rows ?? [];
$filters = $filters ?? [];
$summary = array_replace(['total' => 0, 'active' => 0, 'owners' => 0, 'pharmacists' => 0], $summary ?? []);
$roleOptions = $roleOptions ?? [];
$statusOptions = $statusOptions ?? [];
$canCreateOwner = (bool) ($canCreateOwner ?? false);
$branches = is_admin_geral() ? (new App\Services\BranchService())->all() : [];
$currentRole = (string) ($filters['role'] ?? 'all');
$currentStatus = (string) ($filters['status'] ?? 'all');
$query = (string) ($filters['q'] ?? '');

$roleSelect = static function (?string $selected = null) use ($roleOptions): string {
    $html = '';
    foreach ($roleOptions as $value => $label) {
        $html .= '<option value="' . e($value) . '"' . ($selected === $value ? ' selected' : '') . '>' . e($label) . '</option>';
    }
    return $html;
};

$statusSelect = static function (?string $selected = 'active') use ($statusOptions): string {
    $html = '';
    foreach ($statusOptions as $value => $label) {
        $html .= '<option value="' . e($value) . '"' . ($selected === $value ? ' selected' : '') . '>' . e($label) . '</option>';
    }
    return $html;
};
?>

<section class="section-head staff-head">
  <div>
    <p class="eyebrow">Equipe e acessos</p>
    <h1>Funcionarios</h1>
    <p>Gerencie Donos, administradores, farmaceuticos, atendentes e funcionarios com auditoria e regras de permissao no back-end.</p>
  </div>
  <div class="actions">
    <button class="btn secondary" type="button" data-open-modal="staff-form-modal" data-default-role="employee">Novo Funcionario</button>
    <?php if ($canCreateOwner): ?>
      <button class="btn primary" type="button" data-open-modal="staff-form-modal" data-default-role="owner">Novo Dono/Admin</button>
    <?php endif; ?>
  </div>
</section>

<div class="metric-grid staff-metrics">
  <div class="metric metric-icon customers"><span>Total da equipe</span><strong><?= (int) $summary['total'] ?></strong><small>Usuarios administrativos</small></div>
  <div class="metric success metric-icon customers"><span>Ativos</span><strong><?= (int) $summary['active'] ?></strong><small>Acessos liberados</small></div>
  <div class="metric warning metric-icon stock"><span>Donos ativos</span><strong><?= (int) $summary['owners'] ?></strong><small>Protecao contra ultimo Dono</small></div>
  <div class="metric metric-icon prescription"><span>Farmaceuticos</span><strong><?= (int) $summary['pharmacists'] ?></strong><small>Validacao clinica</small></div>
</div>

<section class="panel staff-controls">
  <form class="filters inline-filters" method="get" action="/admin/funcionarios">
    <label>Busca
      <input type="search" name="q" value="<?= e($query) ?>" placeholder="Nome, e-mail, CPF, telefone ou cargo">
    </label>
    <label>Tipo de usuario
      <select name="role">
        <option value="all">Todos os perfis</option>
        <?php foreach ($roleOptions as $value => $label): ?>
          <option value="<?= e($value) ?>" <?= $currentRole === $value ? 'selected' : '' ?>><?= e($label) ?></option>
        <?php endforeach; ?>
      </select>
    </label>
    <label>Status
      <select name="status">
        <option value="all">Todos os status</option>
        <?php foreach ($statusOptions as $value => $label): ?>
          <option value="<?= e($value) ?>" <?= $currentStatus === $value ? 'selected' : '' ?>><?= e($label) ?></option>
        <?php endforeach; ?>
      </select>
    </label>
    <div class="actions">
      <button class="btn primary" type="submit">Filtrar</button>
      <a class="btn" href="/admin/funcionarios">Limpar</a>
    </div>
  </form>
</section>

<?php if (!$canCreateOwner): ?>
  <section class="alert warning">Gerentes podem gerenciar farmaceuticos e funcionarios apenas da propria filial. Admin geral gerencia todos os perfis.</section>
<?php endif; ?>

<?php if (empty($rows)): ?>
  <section class="empty-state">
    <h2>Nenhum funcionario encontrado</h2>
    <p>Ajuste os filtros ou cadastre um novo acesso administrativo.</p>
  </section>
<?php else: ?>
  <div class="table-wrap staff-table">
    <table>
      <thead>
        <tr>
          <th>Funcionario</th>
          <th>Contato</th>
          <th>Cargo</th>
          <th>Filial</th>
          <th>Perfil</th>
          <th>Permissoes</th>
          <th>Status</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
      <?php foreach ($rows as $row): ?>
        <?php
          $isOwnerRow = (string) ($row['primary_role'] ?? '') === 'owner';
          $modalId = 'staff-view-' . (int) $row['user_id'];
          $editId = 'staff-edit-' . (int) $row['user_id'];
          $statusId = 'staff-status-' . (int) $row['user_id'];
          $deleteId = 'staff-delete-' . (int) $row['user_id'];
          $displayName = (string) (($row['display_name'] ?? '') ?: $row['name']);
          $accountStatus = (string) ($row['account_status'] ?? 'inactive');
          $nextStatus = $accountStatus === 'active' ? 'inactive' : 'active';
        ?>
        <tr class="<?= $isOwnerRow ? 'staff-owner-row' : '' ?>">
          <td>
            <div class="staff-person">
              <span class="staff-avatar" aria-hidden="true">
                <?php if (!empty($row['profile_photo_path'])): ?>
                  <img src="<?= e($row['profile_photo_path']) ?>" alt="">
                <?php else: ?>
                  <?= e(strtoupper(substr(trim($displayName), 0, 1) ?: 'F')) ?>
                <?php endif; ?>
              </span>
              <div>
                <strong><?= e($displayName) ?></strong>
                <span class="helper"><?= e($row['employee_code'] ?? 'Sem codigo') ?></span>
              </div>
            </div>
          </td>
          <td><?= e($row['email']) ?><br><span class="helper"><?= e($row['phone'] ?? '') ?></span></td>
          <td><?= e($row['position'] ?? 'Administrativo') ?><br><span class="helper">CPF <?= e($row['cpf_masked'] ?? 'pendente') ?></span></td>
          <td><?= e($row['filial_nome'] ?? 'Matriz') ?></td>
          <td><span class="tag <?= e($row['role_class'] ?? 'neutral') ?>"><?= e($row['role_label'] ?? 'Funcionario') ?></span></td>
          <td>
            <div class="tag-row">
              <?= !empty($row['is_pharmacist']) ? '<span class="tag success">Farmaceutico</span>' : '<span class="tag neutral">Administrativo</span>' ?>
              <?= !empty($row['can_validate_prescriptions']) ? '<span class="tag blue">Valida receitas</span>' : '<span class="tag neutral">Sem validacao Rx</span>' ?>
            </div>
          </td>
          <td><?= status_pill($accountStatus) ?></td>
          <td class="table-actions">
            <button class="btn small" type="button" data-open-modal="<?= e($modalId) ?>">Ver</button>
            <button class="btn small secondary" type="button" data-open-modal="<?= e($editId) ?>">Editar</button>
            <button class="btn small" type="button" data-open-modal="<?= e($statusId) ?>"><?= $accountStatus === 'active' ? 'Desativar' : 'Ativar' ?></button>
            <button class="btn small danger" type="button" data-open-modal="<?= e($deleteId) ?>">Excluir</button>
          </td>
        </tr>
      <?php endforeach; ?>
      </tbody>
    </table>
  </div>

  <?php foreach ($rows as $row): ?>
    <?php
      $displayName = (string) (($row['display_name'] ?? '') ?: $row['name']);
      $accountStatus = (string) ($row['account_status'] ?? 'inactive');
      $nextStatus = $accountStatus === 'active' ? 'inactive' : 'active';
      $modalId = 'staff-view-' . (int) $row['user_id'];
      $editId = 'staff-edit-' . (int) $row['user_id'];
      $statusId = 'staff-status-' . (int) $row['user_id'];
      $deleteId = 'staff-delete-' . (int) $row['user_id'];
    ?>

    <div class="modal staff-modal" id="<?= e($modalId) ?>" aria-hidden="true" role="dialog" aria-modal="true" aria-label="Detalhes do funcionario">
      <div class="modal-backdrop" data-modal-close></div>
      <div class="modal-panel staff-modal-panel">
        <button class="btn modal-close" type="button" data-modal-close aria-label="Fechar">x</button>
        <div class="staff-modal-body">
          <p class="eyebrow">Perfil administrativo</p>
          <h2><?= e($displayName) ?></h2>
          <div class="staff-detail-grid">
            <div><span>Perfil</span><strong><?= e($row['role_label'] ?? 'Funcionario') ?></strong></div>
            <div><span>Status</span><strong><?= e(status_label($accountStatus)) ?></strong></div>
            <div><span>E-mail</span><strong><?= e($row['email']) ?></strong></div>
            <div><span>Telefone</span><strong><?= e($row['phone'] ?? 'Nao informado') ?></strong></div>
            <div><span>CPF</span><strong><?= e($row['cpf_masked'] ?? 'Pendente') ?></strong></div>
            <div><span>Cargo</span><strong><?= e($row['position'] ?? 'Administrativo') ?></strong></div>
            <div><span>CRF</span><strong><?= e($row['crf_number'] ?? 'Nao informado') ?></strong></div>
            <div><span>Criado em</span><strong><?= e($row['created_at'] ?? '') ?></strong></div>
          </div>
        </div>
      </div>
    </div>

    <div class="modal staff-modal" id="<?= e($editId) ?>" aria-hidden="true" role="dialog" aria-modal="true" aria-label="Editar funcionario">
      <div class="modal-backdrop" data-modal-close></div>
      <div class="modal-panel staff-modal-panel">
        <button class="btn modal-close" type="button" data-modal-close aria-label="Fechar">x</button>
        <form class="staff-form" action="/admin/funcionarios/<?= (int) $row['user_id'] ?>" method="post" enctype="multipart/form-data" data-staff-form>
          <?= csrf_field() ?>
          <div class="staff-modal-body">
            <p class="eyebrow">Editar acesso</p>
            <h2><?= e($displayName) ?></h2>
            <div class="form-grid">
              <label>Nome completo
                <input name="name" value="<?= e($row['name']) ?>" required autocomplete="name">
              </label>
              <label>E-mail
                <input type="email" name="email" value="<?= e($row['email']) ?>" required autocomplete="email">
              </label>
              <label>CPF
                <input name="cpf" value="<?= e($row['cpf_masked'] ?? '') ?>" required data-mask="cpf" inputmode="numeric">
              </label>
              <label>Telefone
                <input name="phone" value="<?= e($row['phone'] ?? '') ?>" data-mask="phone" inputmode="tel">
              </label>
              <label>Cargo
                <input name="position" value="<?= e($row['position'] ?? '') ?>" required>
              </label>
              <?php if (is_admin_geral()): ?>
                <label>Filial
                  <select name="id_filial" required>
                    <?php foreach ($branches as $branch): ?>
                      <option value="<?= (int) $branch['id'] ?>" <?= (int) ($row['id_filial'] ?? 0) === (int) $branch['id'] ? 'selected' : '' ?>><?= e($branch['nome']) ?></option>
                    <?php endforeach; ?>
                  </select>
                </label>
              <?php endif; ?>
              <label>Tipo de usuario
                <select name="role" required>
                  <?= $roleSelect((string) ($row['primary_role'] ?? 'employee')) ?>
                </select>
              </label>
              <label>Status da conta
                <select name="status" required>
                  <?= $statusSelect($accountStatus) ?>
                </select>
              </label>
              <label>CRF
                <input name="crf_number" value="<?= e($row['crf_number'] ?? '') ?>" placeholder="Obrigatorio para farmaceutico">
              </label>
              <label>Carga horaria
                <input name="carga_horaria" value="<?= e($row['carga_horaria'] ?? '') ?>" placeholder="Ex.: 40h semanais">
              </label>
              <label>Turno
                <input name="turno" value="<?= e($row['turno'] ?? '') ?>" placeholder="Ex.: Manha">
              </label>
              <label>Nova senha
                <input type="password" name="password" autocomplete="new-password" minlength="8" pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}" title="Minimo 8 caracteres, maiuscula, minuscula, numero e caractere especial">
              </label>
              <label>Confirmar nova senha
                <input type="password" name="password_confirmation" autocomplete="new-password">
              </label>
              <label>Foto de perfil
                <input type="file" name="profile_photo" accept="image/png,image/jpeg,image/webp">
              </label>
            </div>
            <label class="check"><input type="checkbox" name="can_validate_prescriptions" value="1" <?= !empty($row['can_validate_prescriptions']) ? 'checked' : '' ?>> Pode validar receitas medicas</label>
            <label class="check"><input type="checkbox" name="responsavel_tecnico" value="1" <?= !empty($row['responsavel_tecnico']) ? 'checked' : '' ?>> Responsavel tecnico da filial</label>
            <div class="actions staff-modal-actions">
              <button class="btn primary" type="submit">Salvar alteracoes</button>
              <button class="btn" type="button" data-modal-close>Cancelar</button>
            </div>
          </div>
        </form>
      </div>
    </div>

    <div class="modal staff-modal" id="<?= e($statusId) ?>" aria-hidden="true" role="dialog" aria-modal="true" aria-label="Confirmar alteracao de status">
      <div class="modal-backdrop" data-modal-close></div>
      <div class="modal-panel confirm-panel">
        <button class="btn modal-close" type="button" data-modal-close aria-label="Fechar">x</button>
        <form action="/admin/funcionarios/<?= (int) $row['user_id'] ?>/status" method="post">
          <?= csrf_field() ?>
          <input type="hidden" name="status" value="<?= e($nextStatus) ?>">
          <div class="staff-modal-body">
            <p class="eyebrow">Confirmacao</p>
            <h2><?= $accountStatus === 'active' ? 'Desativar funcionario' : 'Ativar funcionario' ?></h2>
            <p>Esta acao sera registrada nos logs administrativos. Se o usuario for o ultimo Dono ativo, o sistema bloqueara a operacao.</p>
            <div class="actions staff-modal-actions">
              <button class="btn <?= $nextStatus === 'inactive' ? 'danger' : 'primary' ?>" type="submit"><?= $accountStatus === 'active' ? 'Desativar' : 'Ativar' ?></button>
              <button class="btn" type="button" data-modal-close>Cancelar</button>
            </div>
          </div>
        </form>
      </div>
    </div>

    <div class="modal staff-modal" id="<?= e($deleteId) ?>" aria-hidden="true" role="dialog" aria-modal="true" aria-label="Confirmar exclusao">
      <div class="modal-backdrop" data-modal-close></div>
      <div class="modal-panel confirm-panel">
        <button class="btn modal-close" type="button" data-modal-close aria-label="Fechar">x</button>
        <form action="/admin/funcionarios/<?= (int) $row['user_id'] ?>/excluir" method="post">
          <?= csrf_field() ?>
          <div class="staff-modal-body">
            <p class="eyebrow">Exclusao segura</p>
            <h2>Excluir <?= e($displayName) ?>?</h2>
            <p>A exclusao e logica, revoga o acesso e mantem trilha de auditoria. O ultimo Dono ativo nunca pode ser removido.</p>
            <div class="actions staff-modal-actions">
              <button class="btn danger" type="submit">Excluir acesso</button>
              <button class="btn" type="button" data-modal-close>Cancelar</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  <?php endforeach; ?>
<?php endif; ?>

<div class="modal staff-modal" id="staff-form-modal" aria-hidden="true" role="dialog" aria-modal="true" aria-label="Novo funcionario">
  <div class="modal-backdrop" data-modal-close></div>
  <div class="modal-panel staff-modal-panel">
    <button class="btn modal-close" type="button" data-modal-close aria-label="Fechar">x</button>
    <form class="staff-form" action="/admin/funcionarios" method="post" enctype="multipart/form-data" data-staff-form>
      <?= csrf_field() ?>
      <div class="staff-modal-body">
        <p class="eyebrow">Novo acesso</p>
        <h2>Cadastrar funcionario</h2>
        <div class="form-grid">
          <label>Nome completo
            <input name="name" required autocomplete="name">
          </label>
          <label>E-mail
            <input type="email" name="email" required autocomplete="email">
          </label>
          <label>CPF
            <input name="cpf" required data-mask="cpf" inputmode="numeric">
          </label>
          <label>Telefone
            <input name="phone" data-mask="phone" inputmode="tel">
          </label>
          <label>Cargo
            <input name="position" required placeholder="Ex.: Gerente, Farmaceutico, Atendente">
          </label>
          <?php if (is_admin_geral()): ?>
            <label>Filial
              <select name="id_filial" required>
                <?php foreach ($branches as $branch): ?>
                  <option value="<?= (int) $branch['id'] ?>"><?= e($branch['nome']) ?></option>
                <?php endforeach; ?>
              </select>
            </label>
          <?php endif; ?>
          <label>Tipo de usuario
            <select name="role" required data-staff-role>
              <?= $roleSelect($canCreateOwner ? 'admin' : 'employee') ?>
            </select>
          </label>
          <label>Senha
            <input type="password" name="password" required autocomplete="new-password" minlength="8" pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}" title="Minimo 8 caracteres, maiuscula, minuscula, numero e caractere especial">
          </label>
          <label>Confirmacao de senha
            <input type="password" name="password_confirmation" required autocomplete="new-password">
          </label>
          <label>Status da conta
            <select name="status" required>
              <?= $statusSelect('active') ?>
            </select>
          </label>
          <label>CRF
            <input name="crf_number" placeholder="Obrigatorio para farmaceutico">
          </label>
          <label>Carga horaria
            <input name="carga_horaria" placeholder="Ex.: 40h semanais">
          </label>
          <label>Turno
            <input name="turno" placeholder="Ex.: Manha">
          </label>
          <label>Foto de perfil
            <input type="file" name="profile_photo" accept="image/png,image/jpeg,image/webp">
          </label>
        </div>
        <label class="check"><input type="checkbox" name="can_validate_prescriptions" value="1"> Pode validar receitas medicas</label>
        <label class="check"><input type="checkbox" name="responsavel_tecnico" value="1"> Responsavel tecnico da filial</label>
        <p class="helper">Admin geral pode criar perfis globais. Gerentes ficam limitados a equipe da propria filial.</p>
        <div class="actions staff-modal-actions">
          <button class="btn primary" type="submit">Criar usuario</button>
          <button class="btn" type="button" data-modal-close>Cancelar</button>
        </div>
      </div>
    </form>
  </div>
</div>
