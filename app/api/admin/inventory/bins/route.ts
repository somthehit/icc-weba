// app/api/admin/inventory/bins/route.ts
// Warehouse Bins Management (Zone -> Rack -> Shelf -> Bin) and Scan-to-Putaway

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { warehouseBins, productSerials } from '@/db/schema/warehouse-enterprise';
import { warehouses } from '@/db/schema/inventory';
import { products } from '@/db/schema/catalog';
import { auditLogs } from '@/db/schema/audit';
import { eq, desc, count } from 'drizzle-orm';

// GET: List all bins with occupancy
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    let warehouseId = searchParams.get('warehouseId');
    if (!warehouseId) {
      const [firstWh] = await db.select({ id: warehouses.id }).from(warehouses).limit(1);
      warehouseId = firstWh?.id || '00000000-0000-0000-0000-000000000001';
    }

    const bins = await db
      .select({
        id: warehouseBins.id,
        warehouseId: warehouseBins.warehouseId,
        warehouseName: warehouses.name,
        zone: warehouseBins.zone,
        rack: warehouseBins.rack,
        shelf: warehouseBins.shelf,
        bin: warehouseBins.bin,
        code: warehouseBins.code,
        description: warehouseBins.description,
        capacityUnits: warehouseBins.capacityUnits,
        currentUsage: warehouseBins.currentUsage,
        isActive: warehouseBins.isActive,
        createdAt: warehouseBins.createdAt,
      })
      .from(warehouseBins)
      .leftJoin(warehouses, eq(warehouseBins.warehouseId, warehouses.id))
      .where(eq(warehouseBins.warehouseId, warehouseId))
      .orderBy(warehouseBins.zone, warehouseBins.rack, warehouseBins.shelf, warehouseBins.bin);

    // If no bins exist yet, seed standard zones
    if (bins.length === 0) {
      const defaultBins = [
        { zone: 'A', rack: '01', shelf: 'S1', bin: 'B01', code: 'WH1-Z-A-R01-S1-B01', description: 'Laptops & MacBooks High Security Bay' },
        { zone: 'A', rack: '01', shelf: 'S2', bin: 'B02', code: 'WH1-Z-A-R01-S2-B02', description: 'Gaming Laptops Rack' },
        { zone: 'B', rack: '02', shelf: 'S1', bin: 'B01', code: 'WH1-Z-B-R02-S1-B01', description: 'APC & Microtek Heavy UPS Floor Bay' },
        { zone: 'B', rack: '02', shelf: 'S2', bin: 'B02', code: 'WH1-Z-B-R02-S2-B02', description: 'Line Interactive Inverters Bay' },
        { zone: 'C', rack: '03', shelf: 'S1', bin: 'B01', code: 'WH1-Z-C-R03-S1-B01', description: 'Hikvision CCTV & NVR Secure Shelf' },
        { zone: 'C', rack: '03', shelf: 'S2', bin: 'B02', code: 'WH1-Z-C-R03-S2-B02', description: 'Canon & Epson EcoTank Printers Bay' },
        { zone: 'D', rack: '04', shelf: 'S1', bin: 'B01', code: 'WH1-Z-D-R04-S1-B01', description: 'TP-Link & Ruijie Enterprise Networking' },
        { zone: 'D', rack: '04', shelf: 'S2', bin: 'B02', code: 'WH1-Z-D-R04-S2-B02', description: 'SSD / RAM High-Density Drawers' },
      ];

      for (const b of defaultBins) {
        await db.insert(warehouseBins).values({
          warehouseId,
          ...b,
          capacityUnits: 150,
          currentUsage: 12,
        });
      }

      // Re-fetch
      const seeded = await db.select().from(warehouseBins).where(eq(warehouseBins.warehouseId, warehouseId));
      return NextResponse.json({ success: true, bins: seeded });
    }

    return NextResponse.json({
      success: true,
      bins,
    });
  } catch (error: any) {
    console.error('Failed to fetch warehouse bins:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST: Create bin or Putaway Serial/SKU into Bin
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    // 1. Create / Configure Warehouse Bin
    if (action === 'create-bin') {
      const {
        warehouseId,
        zone = 'A',
        rack = '01',
        shelf = 'S1',
        bin = 'B01',
        description = '',
        capacityUnits = 100,
      } = body;

      let targetWarehouseId = warehouseId ? String(warehouseId) : null;
      if (!targetWarehouseId) {
        const [firstWh] = await db.select({ id: warehouses.id }).from(warehouses).limit(1);
        targetWarehouseId = firstWh?.id || '00000000-0000-0000-0000-000000000001';
      }

      const code = `WH-Z-${zone.toUpperCase()}-R${rack}-S${shelf}-B${bin}`.toUpperCase();

      const [newBin] = await db
        .insert(warehouseBins)
        .values({
          warehouseId: targetWarehouseId,
          zone: zone.toUpperCase(),
          rack,
          shelf,
          bin,
          code,
          description,
          capacityUnits: parseInt(String(capacityUnits), 10) || 100,
        })
        .returning();

      return NextResponse.json({
        success: true,
        message: `Bin location "${code}" created successfully.`,
        bin: newBin,
      });
    }

    // 2. Scan-to-Putaway (Assign Serial/Item to Bin)
    if (action === 'putaway') {
      const { serialNumber, binCode, staffName = 'Storekeeper' } = body;

      if (!serialNumber || !binCode) {
        return NextResponse.json(
          { success: false, error: 'Serial number and destination bin code are required.' },
          { status: 400 }
        );
      }

      const [targetBin] = await db
        .select()
        .from(warehouseBins)
        .where(eq(warehouseBins.code, binCode.trim().toUpperCase()))
        .limit(1);

      if (!targetBin) {
        return NextResponse.json({ success: false, error: `Bin code "${binCode}" not found.` }, { status: 404 });
      }

      const [targetSerial] = await db
        .select()
        .from(productSerials)
        .where(eq(productSerials.serialNumber, serialNumber.trim()))
        .limit(1);

      if (!targetSerial) {
        return NextResponse.json(
          { success: false, error: `Serial unit "${serialNumber}" not found in inventory.` },
          { status: 404 }
        );
      }

      // Update serial location
      await db
        .update(productSerials)
        .set({
          warehouseId: targetBin.warehouseId,
          binId: targetBin.id,
          updatedAt: new Date(),
        })
        .where(eq(productSerials.id, targetSerial.id));

      // Increment bin usage
      await db
        .update(warehouseBins)
        .set({
          currentUsage: targetBin.currentUsage + 1,
          updatedAt: new Date(),
        })
        .where(eq(warehouseBins.id, targetBin.id));

      await db.insert(auditLogs).values({
        action: 'warehouse.putaway_completed',
        entityType: 'serial',
        entityId: targetSerial.id,
        metadata: {
          serialNumber,
          binCode: targetBin.code,
          staffName,
        },
      });

      return NextResponse.json({
        success: true,
        message: `Unit S/N: ${serialNumber} successfully putaway to bin ${targetBin.code}!`,
      });
    }

    return NextResponse.json({ success: false, error: 'Unknown action.' }, { status: 400 });
  } catch (error: any) {
    console.error('Bin action error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
