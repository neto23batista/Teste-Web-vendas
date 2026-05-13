-- FarmaVida
-- Module: admin staff management
-- Purpose: owner-only employee provisioning, CPF/profile metadata and base employee role.

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 1;

ALTER TABLE admins
  ADD COLUMN cpf_hash CHAR(64) NULL AFTER crf_number,
  ADD COLUMN cpf_masked VARCHAR(20) NULL AFTER cpf_hash,
  ADD COLUMN cpf_last4 CHAR(4) NULL AFTER cpf_masked,
  ADD COLUMN profile_photo_path VARCHAR(500) NULL AFTER can_validate_prescriptions,
  ADD COLUMN created_by BIGINT UNSIGNED NULL AFTER status,
  ADD COLUMN updated_by BIGINT UNSIGNED NULL AFTER created_by,
  ADD UNIQUE KEY uq_admins_cpf_hash (cpf_hash),
  ADD KEY idx_admins_created_by (created_by),
  ADD KEY idx_admins_updated_by (updated_by),
  ADD CONSTRAINT fk_admins_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_admins_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;

INSERT INTO roles (name, slug, description, is_system) VALUES
('Funcionario comum', 'employee', 'Acesso administrativo basico para rotinas internas limitadas.', 1)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  description = VALUES(description),
  is_system = VALUES(is_system),
  updated_at = CURRENT_TIMESTAMP;

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
INNER JOIN permissions p ON p.slug IN ('dashboard.view')
WHERE r.slug = 'employee';
