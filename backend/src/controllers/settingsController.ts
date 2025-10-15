import { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { settingsService } from '../services/settingsService';
import { TenantSettingsService } from '../services/tenantSettingsService';
import { AuthenticatedRequest } from '../middleware/auth';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const tenantSettingsService = new TenantSettingsService();


// Configuração do multer para upload de logos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = '/app/uploads';
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const fileName = `logo_${Date.now()}${ext}`;
    cb(null, fileName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/x-icon', 'image/vnd.microsoft.icon'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Tipo de arquivo não permitido: ${file.mimetype}. Use JPEG, PNG, GIF, WebP ou ICO.`));
    }
  }
});

// Validation rules
export const settingsValidation = [
  body('wahaHost').optional().custom((value) => {
    if (!value || value === '') return true;
    if (!/^https?:\/\/.+/.test(value)) {
      throw new Error('Host WAHA deve ser uma URL válida');
    }
    return true;
  }),
  body('wahaApiKey').optional().custom((value) => {
    if (!value || value === '') return true;
    if (value.length < 10) {
      throw new Error('API Key deve ter pelo menos 10 caracteres');
    }
    return true;
  }),
  body('companyName').optional().custom((value) => {
    if (!value || value === '') return true;
    if (value.length < 1 || value.length > 100) {
      throw new Error('Nome da empresa deve ter entre 1 e 100 caracteres');
    }
    return true;
  }),
  body('pageTitle').optional().custom((value) => {
    if (!value || value === '') return true;
    if (value.length < 1 || value.length > 100) {
      throw new Error('Título da página deve ter entre 1 e 100 caracteres');
    }
    return true;
  }),
  body('openaiApiKey').optional().custom((value) => {
    if (!value || value === '') return true;
    if (value.length < 10) {
      throw new Error('API Key da OpenAI deve ter pelo menos 10 caracteres');
    }
    return true;
  }),
  body('groqApiKey').optional().custom((value) => {
    if (!value || value === '') return true;
    if (value.length < 10) {
      throw new Error('API Key da Groq deve ter pelo menos 10 caracteres');
    }
    return true;
  }),
  body('evolutionHost').optional().custom((value) => {
    if (!value || value === '') return true;
    if (!/^https?:\/\/.+/.test(value)) {
      throw new Error('Host Evolution deve ser uma URL válida');
    }
    return true;
  }),
  body('evolutionApiKey').optional().custom((value) => {
    if (!value || value === '') return true;
    if (value.length < 10) {
      throw new Error('API Key Evolution deve ter pelo menos 10 caracteres');
    }
    return true;
  }),
  body('digitalSacHost').optional().custom((value) => {
    if (!value || value === '') return true;
    if (!/^https?:\/\/.+/.test(value)) {
      throw new Error('Host DigitalSac deve ser uma URL válida');
    }
    return true;
  }),
  body('digitalSacToken').optional().custom((value) => {
    if (!value || value === '') return true;
    if (value.length < 10) {
      throw new Error('Token DigitalSac deve ter pelo menos 10 caracteres');
    }
    return true;
  })
];

// Get settings
export const getSettings = async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Buscar configurações globais
    const globalSettings = await settingsService.getSettings();

    // Para configurações AI, usar tenantId do usuário, ou parâmetro tenantId para SUPERADMIN
    let effectiveTenantId = req.tenantId;
    if (req.user?.role === 'SUPERADMIN') {
      // SUPERADMIN pode gerenciar configurações de qualquer tenant
      effectiveTenantId = (req.query.tenantId as string) || 'aa135abc-56bf-400a-b980-cc2a38f0a2b4';
    }

    // Buscar configurações do tenant (APIs de IA)
    let tenantSettings = null;
    if (effectiveTenantId) {
      try {
        tenantSettings = await tenantSettingsService.getTenantSettings(effectiveTenantId);
      } catch (error) {
        console.warn('Erro ao buscar configurações do tenant:', error);
      }
    }

    // Combinar as configurações
    const combinedSettings = {
      ...globalSettings,
      openaiApiKey: tenantSettings?.openaiApiKey || null,
      groqApiKey: tenantSettings?.groqApiKey || null
    };

    res.json(combinedSettings);
  } catch (error) {
    console.error('Erro ao buscar configurações:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

// Get public settings (favicon, page title, icon and company name, no auth required)
export const getPublicSettings = async (req: Request, res: Response) => {
  try {
    const settings = await settingsService.getSettings();
    res.json({
      faviconUrl: settings.faviconUrl,
      pageTitle: settings.pageTitle,
      iconUrl: settings.iconUrl,
      companyName: settings.companyName
    });
  } catch (error) {
    console.error('Erro ao buscar configurações públicas:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

// Update settings
export const updateSettings = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { wahaHost, wahaApiKey, evolutionHost, evolutionApiKey, digitalSacHost, digitalSacToken, companyName, pageTitle, openaiApiKey, groqApiKey, tenantId } = req.body;

    // Atualizar configurações globais
    const globalSettings = await settingsService.updateSettings({
      wahaHost,
      wahaApiKey,
      evolutionHost,
      evolutionApiKey,
      digitalSacHost,
      digitalSacToken,
      companyName,
      pageTitle
    });

    // Para configurações AI, usar tenantId do usuário, ou parâmetro tenantId para SUPERADMIN
    let effectiveTenantId = req.tenantId;
    if (req.user?.role === 'SUPERADMIN') {
      // SUPERADMIN pode gerenciar configurações de qualquer tenant
      effectiveTenantId = tenantId || 'aa135abc-56bf-400a-b980-cc2a38f0a2b4';
    }

    // Atualizar configurações do tenant (APIs de IA)
    let tenantSettings = null;
    if (effectiveTenantId && (openaiApiKey !== undefined || groqApiKey !== undefined)) {
      tenantSettings = await tenantSettingsService.updateTenantSettings(effectiveTenantId, {
        openaiApiKey,
        groqApiKey
      });
    }

    // Combinar as configurações para resposta
    const combinedSettings = {
      ...globalSettings,
      openaiApiKey: tenantSettings?.openaiApiKey || null,
      groqApiKey: tenantSettings?.groqApiKey || null
    };

    res.json({
      message: 'Configurações atualizadas com sucesso',
      settings: combinedSettings
    });
  } catch (error) {
    console.error('Erro ao atualizar configurações:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

// Upload logo
export const uploadLogo = [
  upload.single('logo'),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'Nenhum arquivo enviado' });
      }

      // URL da logo (será servida estaticamente)
      const logoUrl = `/api/uploads/${req.file.filename}`;

      // Atualizar configurações com nova logo
      const settings = await settingsService.updateSettings({
        logoUrl
      });

      res.json({
        message: 'Logo carregada com sucesso',
        logoUrl,
        settings
      });
    } catch (error) {
      console.error('Erro ao fazer upload da logo:', error);

      // Remover arquivo se houve erro
      if (req.file) {
        fs.unlink(req.file.path, (err) => {
          if (err) console.error('Erro ao remover arquivo:', err);
        });
      }

      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
];

// Upload favicon
export const uploadFavicon = [
  upload.single('favicon'),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'Nenhum arquivo enviado' });
      }

      // URL do favicon (será servida estaticamente)
      const faviconUrl = `/api/uploads/${req.file.filename}`;

      // Atualizar configurações com novo favicon
      const settings = await settingsService.updateSettings({
        faviconUrl
      });

      res.json({
        message: 'Favicon carregado com sucesso',
        faviconUrl,
        settings
      });
    } catch (error) {
      console.error('Erro ao fazer upload do favicon:', error);

      // Remover arquivo se houve erro
      if (req.file) {
        fs.unlink(req.file.path, (err) => {
          if (err) console.error('Erro ao remover arquivo:', err);
        });
      }

      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
];

// Remove favicon
export const removeFavicon = async (req: Request, res: Response) => {
  try {
    const settings = await settingsService.getSettings();

    if (settings.faviconUrl) {
      // Remover arquivo físico
      const filePath = path.join('/app/uploads', path.basename(settings.faviconUrl.replace('/api/uploads/', '')));
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    // Atualizar configurações removendo favicon
    const updatedSettings = await settingsService.updateSettings({
      faviconUrl: null
    });

    res.json({
      message: 'Favicon removido com sucesso',
      settings: updatedSettings
    });
  } catch (error) {
    console.error('Erro ao remover favicon:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

// Remove logo
export const removeLogo = async (req: Request, res: Response) => {
  try {
    const settings = await settingsService.getSettings();

    if (settings.logoUrl) {
      // Remover arquivo físico
      const filePath = path.join('/app/uploads', path.basename(settings.logoUrl.replace('/api/uploads/', '')));
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    // Atualizar configurações removendo logo
    const updatedSettings = await settingsService.updateSettings({
      logoUrl: null
    });

    res.json({
      message: 'Logo removida com sucesso',
      settings: updatedSettings
    });
  } catch (error) {
    console.error('Erro ao remover logo:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

// Upload icon
export const uploadIcon = [
  upload.single('icon'),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'Nenhum arquivo enviado' });
      }

      // URL do ícone (será servida estaticamente)
      const iconUrl = `/api/uploads/${req.file.filename}`;

      // Atualizar configurações com novo ícone
      const settings = await settingsService.updateSettings({
        iconUrl
      });

      res.json({
        message: 'Ícone carregado com sucesso',
        iconUrl,
        settings
      });
    } catch (error) {
      console.error('Erro ao fazer upload do ícone:', error);

      // Remover arquivo se houve erro
      if (req.file) {
        fs.unlink(req.file.path, (err) => {
          if (err) console.error('Erro ao remover arquivo:', err);
        });
      }

      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
];

// Remove icon
export const removeIcon = async (req: Request, res: Response) => {
  try {
    const settings = await settingsService.getSettings();

    if (settings.iconUrl) {
      // Remover arquivo físico
      const filePath = path.join('/app/uploads', path.basename(settings.iconUrl.replace('/api/uploads/', '')));
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    // Atualizar configurações removendo ícone
    const updatedSettings = await settingsService.updateSettings({
      iconUrl: null
    });

    res.json({
      message: 'Ícone removido com sucesso',
      settings: updatedSettings
    });
  } catch (error) {
    console.error('Erro ao remover ícone:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};