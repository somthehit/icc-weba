-- Fix broken Amazon product image URLs (all returning 404)
-- Replace with reliable picsum.photos placeholders

DELETE FROM product_images WHERE product_id BETWEEN 1 AND 30;

INSERT INTO product_images (product_id, url, alt_text, display_order, is_primary) VALUES
(1,'https://picsum.photos/seed/lenovo-legion-pro5/800/600','Lenovo Legion Pro 5 16" Gaming Laptop',0,true),
(1,'https://picsum.photos/seed/lenovo-legion-pro5-2/800/600','Lenovo Legion Pro 5 16" Gaming Laptop',1,false),

(2,'https://picsum.photos/seed/dell-inspiron-15/800/600','Dell Inspiron 15 3520 Laptop',0,true),
(2,'https://picsum.photos/seed/dell-inspiron-15-2/800/600','Dell Inspiron 15 3520 Laptop',1,false),

(3,'https://picsum.photos/seed/asus-rog-rtx4070/800/600','ASUS ROG Strix RTX 4070 Super',0,true),
(3,'https://picsum.photos/seed/asus-rog-rtx4070-2/800/600','ASUS ROG Strix RTX 4070 Super',1,false),

(4,'https://picsum.photos/seed/macbook-air-m3/800/600','Apple MacBook Air M3',0,true),
(4,'https://picsum.photos/seed/macbook-air-m3-2/800/600','Apple MacBook Air M3',1,false),

(5,'https://picsum.photos/seed/lenovo-loq15/800/600','Lenovo LOQ 15 Gaming Laptop',0,true),
(5,'https://picsum.photos/seed/lenovo-loq15-2/800/600','Lenovo LOQ 15 Gaming Laptop',1,false),

(6,'https://picsum.photos/seed/hp-pavilion-x360/800/600','HP Pavilion x360 14',0,true),
(6,'https://picsum.photos/seed/hp-pavilion-x360-2/800/600','HP Pavilion x360 14',1,false),

(7,'https://picsum.photos/seed/asus-tuf-vg249/800/600','ASUS TUF Gaming VG249Q3A Monitor',0,true),
(7,'https://picsum.photos/seed/asus-tuf-vg249-2/800/600','ASUS TUF Gaming VG249Q3A Monitor',1,false),

(8,'https://picsum.photos/seed/tplink-deco-x50/800/600','TP-Link Deco X50 Mesh WiFi 6',0,true),
(8,'https://picsum.photos/seed/tplink-deco-x50-2/800/600','TP-Link Deco X50 Mesh WiFi 6',1,false),

(9,'https://picsum.photos/seed/samsung-980-1tb/800/600','Samsung 980 1TB NVMe SSD',0,true),

(10,'https://picsum.photos/seed/hikvision-cctv/800/600','Hikvision CCTV Camera Package',0,true),
(10,'https://picsum.photos/seed/hikvision-cctv-2/800/600','Hikvision CCTV Camera Package',1,false),

(11,'https://picsum.photos/seed/epson-l3210/800/600','Epson EcoTank L3210 Printer',0,true),
(11,'https://picsum.photos/seed/epson-l3210-2/800/600','Epson EcoTank L3210 Printer',1,false),

(12,'https://picsum.photos/seed/logitech-mx-master/800/600','Logitech MX Master 3S Mouse',0,true),
(12,'https://picsum.photos/seed/logitech-mx-master-2/800/600','Logitech MX Master 3S Mouse',1,false),

(13,'https://picsum.photos/seed/corsair-vengeance-ddr5/800/600','Corsair Vengeance RGB DDR5 RAM',0,true),

(14,'https://picsum.photos/seed/tplink-archer-ax12/800/600','TP-Link Archer AX12 Router',0,true),

(15,'https://picsum.photos/seed/samsung-43-4k/800/600','Samsung 43" Crystal 4K Smart TV',0,true),
(15,'https://picsum.photos/seed/samsung-43-4k-2/800/600','Samsung 43" Crystal 4K Smart TV',1,false),

(16,'https://picsum.photos/seed/canon-lbp2900/800/600','Canon imageCLASS LBP2900B Printer',0,true),

(17,'https://picsum.photos/seed/msi-mag-forge/800/600','MSI MAG Forge 100R Case',0,true),

(18,'https://picsum.photos/seed/wd-purple-4tb/800/600','WD Purple 4TB Surveillance HDD',0,true),

(19,'https://picsum.photos/seed/intel-i7-13700k/800/600','Intel Core i7-13700K Processor',0,true),

(20,'https://picsum.photos/seed/asus-prime-z790/800/600','ASUS Prime Z790-P WiFi Motherboard',0,true),

(21,'https://picsum.photos/seed/deepcool-ak620/800/600','DeepCool AK620 CPU Cooler',0,true),

(22,'https://picsum.photos/seed/keychron-k2/800/600','Keychron K2 Wireless Keyboard',0,true),
(22,'https://picsum.photos/seed/keychron-k2-2/800/600','Keychron K2 Wireless Keyboard',1,false),

(23,'https://picsum.photos/seed/dahua-nvr/800/600','Dahua 8-Channel NVR System',0,true),

(24,'https://picsum.photos/seed/kingston-nv2-2tb/800/600','Kingston NV2 2TB NVMe SSD',0,true),

(25,'https://picsum.photos/seed/dell-latitude-3420/800/600','Dell Latitude 3420 Business Laptop',0,true),
(25,'https://picsum.photos/seed/dell-latitude-3420-2/800/600','Dell Latitude 3420 Business Laptop',1,false),

(26,'https://picsum.photos/seed/hp-laserjet-m130/800/600','HP LaserJet Pro MFP M130fn',0,true),

(27,'https://picsum.photos/seed/gigabyte-rtx3060/800/600','Gigabyte RTX 3060 WINDFORCE OC',0,true),

(28,'https://picsum.photos/seed/dlink-24port/800/600','D-Link 24-Port Gigabit Switch',0,true),

(29,'https://picsum.photos/seed/apc-backups-1100/800/600','APC Back-UPS 1100VA',0,true),

(30,'https://picsum.photos/seed/epson-l3110/800/600','Epson EcoTank L3110 Printer',0,true);
