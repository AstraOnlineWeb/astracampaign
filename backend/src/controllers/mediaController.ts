import { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Configuração do multer para upload de arquivos de mídia
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = process.env.UPLOAD_DIR || '/app/uploads';
    // Criar diretório se não existir
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const fileName = `media_${Date.now()}${ext}`;
    cb(null, fileName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      // Imagens
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
      // Vídeos
      'video/mp4', 'video/avi', 'video/mov', 'video/wmv', 'video/mkv',
      // Áudios
      'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/aac', 'audio/m4a',
      // Documentos
      'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain', 'text/csv',
      // Arquivos compactados
      'application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed'
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Tipo de arquivo não permitido: ${file.mimetype}. Tipos aceitos: imagens, vídeos, áudios, documentos e arquivos compactados.`));
    }
  }
});

// Upload de arquivo de mídia para campanhas
export const uploadMediaFile = [
  upload.single('file'),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'Nenhum arquivo enviado' });
      }

      // URL pública do arquivo (será servida estaticamente)
      // Gerar URL completa para que o WAHA API possa acessar
      const protocol = req.get('X-Forwarded-Proto') || req.protocol || 'https';
      const host = req.get('Host') || 'work.trecofantastico.com.br';
      const fileUrl = `${protocol}://${host}/api/uploads/${req.file.filename}`;

      res.json({
        message: 'Arquivo carregado com sucesso',
        fileUrl,
        originalName: req.file.originalname,
        filename: req.file.filename,
        mimetype: req.file.mimetype,
        size: req.file.size
      });
    } catch (error) {
      console.error('Erro ao fazer upload do arquivo:', error);

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

// Listar arquivos de mídia
export const listMediaFiles = async (req: Request, res: Response) => {
  try {
    const uploadDir = process.env.UPLOAD_DIR || '/app/uploads';

    if (!fs.existsSync(uploadDir)) {
      return res.json({ files: [] });
    }

    const files = fs.readdirSync(uploadDir)
      .filter(file => file.startsWith('media_'))
      .map(filename => {
        const filePath = path.join(uploadDir, filename);
        const stats = fs.statSync(filePath);

        return {
          filename,
          url: `/api/uploads/${filename}`,
          size: stats.size,
          uploadedAt: stats.birthtime
        };
      })
      .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());

    res.json({ files });
  } catch (error) {
    console.error('Erro ao listar arquivos:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

// Deletar arquivo de mídia
export const deleteMediaFile = async (req: Request, res: Response) => {
  try {
    const { filename } = req.params;

    if (!filename || !filename.startsWith('media_')) {
      return res.status(400).json({ error: 'Nome de arquivo inválido' });
    }

    const uploadDir = process.env.UPLOAD_DIR || '/app/uploads';
    const filePath = path.join(uploadDir, filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Arquivo não encontrado' });
    }

    fs.unlinkSync(filePath);

    res.json({
      message: 'Arquivo removido com sucesso'
    });
  } catch (error) {
    console.error('Erro ao remover arquivo:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};